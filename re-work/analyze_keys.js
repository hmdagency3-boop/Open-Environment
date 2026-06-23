#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SO_PATH = path.join(__dirname, 'libs/lib/armeabi-v7a/libndklib-common.so');
const buf = fs.readFileSync(SO_PATH);

function readU32LE(b, off) { return (b[off] | (b[off+1]<<8) | (b[off+2]<<16) | (b[off+3]<<24)) >>> 0; }
function readU16LE(b, off) { return b[off] | (b[off+1] << 8); }

// ELF: .data VA = 0xC000, file offset = 0x8000
const DATA_VA   = 0xC000;
const DATA_FO   = 0x8000;
const DATA_SIZE = 0x421;

// ─── Simulate LDR+ADD pairs in a function to get final pointer values ────────
// For each LDR Rd, [PC, #imm8*4] followed by ADD Rd, PC,
// compute final VA = stored_offset + PC_of_ADD
function extractPtrsFromFn(fnOffset, fnSize, label) {
  const fnEnd = fnOffset + fnSize;
  const ptrs = [];
  
  for (let i = fnOffset; i < fnEnd - 1; i++) {
    const hw1 = readU16LE(buf, i);
    
    // LDR Rd, [PC, #imm8*4]  →  0x4800..0x4FFF
    if ((hw1 & 0xF800) === 0x4800) {
      const Rd   = (hw1 >> 8) & 0x7;
      const imm8 = hw1 & 0xFF;
      const pc   = (i + 4) & ~3;
      const tgt  = pc + imm8 * 4;
      if (tgt + 3 >= buf.length) { i++; continue; }
      const val  = readU32LE(buf, tgt);
      
      // Now look ahead for ADD Rd, PC  (78 44 style)
      // ADD Rd, PC encoding: 01000100 1111 0Rd_ for low regs
      // For 16-bit ADD: `7x 44` where x encodes Rd
      // More precisely: ADD Rd, Rn encoding: 0100 0100 DN Rm Rdn
      // ADD Rd, PC: Rn=PC(15), so: 0100 0100 Rd 1111 x → 44 7x  (LE: 7x 44)
      // Check next few instructions
      let found = false;
      for (let j = i+2; j < Math.min(i+20, fnEnd-1); j++) {
        const next = readU16LE(buf, j);
        // ADD Rd, PC: first byte = 0x78 | (Rd & 8 ? 0x80 : 0) | Rd&7... complex
        // Simpler: look for 0x44__ where __ encodes PC+Rd
        // 0x44 78 = ADD R0, PC (0111 1000 = DN=1,Rm=1111,Rdn=000 → ADD R0+8bit=R8? no)
        // Let me just look for any 44 7x pattern
        if ((next & 0xFF87) === 0x4400) {
          // This might be ADD but check for PC (Rm=15=0xF)
          // format: 0100 0100 DN Rm Rdn
          //  byte0: 0100 0100 = 0x44
          //  byte1: D N Rm[3:0] R[2:0] (hmm bits don't align with LE)
          // Actually in LE memory: byte[0]=lower, byte[1]=upper
          // 16-bit instruction = byte[1]:byte[0]
          // hw = byte[0] | (byte[1]<<8)
          // `78 44` → hw = 0x4478
          // 0x4478 = 0100 0100 0111 1000
          // ADD encoding: 0100 0100 D N Rm Rdn  (Rm bits[6:3], Rdn bits[2:0]+D)
        }
        // More direct: 0x447x means ADD with PC (Rm=15)
        if ((next & 0xFF78) === 0x4478) {
          const DN = (next >> 7) & 1;
          const Rdn = ((next >> 8) & 0x7) | (DN << 3);  // hmm
          // Actually: hw1 = 0x4478 | (Rd&7) | ((Rd&8)<<4)
          // For Rd=0: 0x4478 | 0x0000 = 0x4478 → stored as `78 44`
          // For Rd=1: 0x4479 | 0x0001 = 0x4479 → stored as `79 44`  
          // Check: does this ADD use our register?
          // simplified: assume ADD Rd, PC where Rd matches the LDR Rd
          if (j === i+2) {  // immediately follows
            const addPC = (j + 4);
            const finalVA = (val + addPC) >>> 0;
            const inData = finalVA >= DATA_VA && finalVA < DATA_VA + DATA_SIZE;
            if (inData) {
              const dataOff = finalVA - DATA_VA;
              ptrs.push({ ldrAt: i.toString(16), reg: Rd, ldVal: val.toString(16), addAt: j.toString(16), addPC: addPC.toString(16), finalVA: finalVA.toString(16), dataFO: (DATA_FO + dataOff).toString(16) });
            }
            found = true;
          }
          break;
        }
        // Stop if we hit another 2-byte LDR or branch
        if ((next & 0xF800) === 0x4800) break;
        if ((next & 0xFF00) === 0xD000) break;
      }
      i += 1;
      continue;
    }
    
    // 32-bit instructions advance by 4
    if (hw1 >= 0xE800) { i += 3; continue; }
    i += 1;
  }
  
  return ptrs;
}

// ─── Key getter functions ─────────────────────────────────────────────────────
const KEY_FNS = [
  { name: 'getDk',         offset: 0x0a4c, size: 84  },
  { name: 'getEk',         offset: 0x2988, size: 140 },
  { name: 'getAkIv',       offset: 0x2cec, size: 144 },
  { name: 'getAk',         offset: 0x2a14, size: 728 },
  { name: 'getNetEaseKey', offset: 0x2d7c, size: 704 },
  { name: 'getAgoraKey',   offset: 0x303c, size: 372 },
];

console.log('=== Key getter function → .data pointer analysis ===\n');
for (const fn of KEY_FNS) {
  const ptrs = extractPtrsFromFn(fn.offset, fn.size, fn.name);
  console.log(`${fn.name} @ 0x${fn.offset.toString(16)}:`);
  if (ptrs.length === 0) {
    // Fallback: just dump the literal pool at end of function
    const poolStart = fn.offset + fn.size - 32;
    process.stdout.write('  literal pool: ');
    for (let i = poolStart; i < fn.offset + fn.size; i += 4) {
      const v = readU32LE(buf, i);
      process.stdout.write(`0x${v.toString(16).padStart(8,'0')} `);
    }
    console.log('');
  } else {
    ptrs.forEach(p => console.log(`  LDR R${p.reg} @ 0x${p.ldrAt} = 0x${p.ldVal}, ADD @ 0x${p.addAt} (PC=0x${p.addPC}) → VA=0x${p.finalVA}, file=0x${p.dataFO}`));
  }
  console.log('');
}

// ─── Alternative: decode literal pools manually ──────────────────────────────
console.log('=== Manual literal pool extraction (last 48 bytes of each fn) ===\n');
for (const fn of KEY_FNS) {
  const poolStart = fn.offset + fn.size - 48;
  console.log(`${fn.name}:`);
  const addrs = [];
  for (let i = poolStart; i < fn.offset + fn.size; i += 4) {
    const v = readU32LE(buf, i);
    addrs.push(v);
    console.log(`  [0x${i.toString(16)}] = 0x${v.toString(16).padStart(8,'0')}`);
  }
  console.log('');
}

// ─── Decode .data section entries ────────────────────────────────────────────
const dataRaw = Buffer.from(buf.slice(DATA_FO, DATA_FO + DATA_SIZE));

// Known: entry at 0x80c0 is "hashCode" (plaintext, XOR key = 0)
// Known: entry at 0x80c9 is "YX8q" (plaintext)
// These tell us XOR was 0 for those areas.

// Parse entries
const entries = [];
let pos = 0;
while (pos < dataRaw.length) {
  if (dataRaw[pos] === 0) { pos++; continue; }
  const start = pos;
  while (pos < dataRaw.length && dataRaw[pos] !== 0) pos++;
  entries.push({ offset: start, fileOff: DATA_FO + start, va: DATA_VA + start, data: Buffer.from(dataRaw.slice(start, pos)) });
}

console.log(`=== .data entries (${entries.length} total) ===\n`);
entries.forEach((e, i) => {
  console.log(`  [${i}] VA=0x${e.va.toString(16)}, file=0x${e.fileOff.toString(16)}, len=${e.data.length}`);
});
console.log('');

// ─── Try to crack each entry using known patterns ────────────────────────────
console.log('=== Trying to crack entries ===\n');

function xorBuf(src, key) {
  const out = Buffer.alloc(src.length);
  for (let j = 0; j < src.length; j++) out[j] = src[j] ^ key[j % key.length];
  return out;
}

function isPrintable(buf) {
  let ok = 0;
  for (const b of buf) {
    if (b >= 0x20 && b <= 0x7e) ok++;
    else if (b === 0 || b === 0x0a || b === 0x09) ok++;
  }
  return ok / buf.length;
}

function isHexStr(s) {
  return /^[0-9a-fA-F]+$/.test(s);
}

function looksLikeJavaClass(s) {
  return s.includes('/') || s.includes('.') || s.includes('(') || s.includes('[') || s.startsWith('com') || s.startsWith('java');
}

function looksLikeAesKey(s) {
  // 32 bytes = 64 hex chars, or just meaningful binary
  return s.length >= 16 && s.length <= 64 && (isHexStr(s) || /^[A-Za-z0-9+/=]+$/.test(s));
}

// For each entry, try exhaustive single-byte + known multi-byte keys
const results = [];
for (const entry of entries) {
  const best = [];
  
  // Try all single-byte XOR keys
  for (let k = 0; k <= 0xFF; k++) {
    const dec = xorBuf(entry.data, Buffer.from([k]));
    const score = isPrintable(dec);
    const s = dec.toString('ascii').replace(/[^\x20-\x7e]/g, '');
    if (score > 0.90 && (looksLikeJavaClass(s) || looksLikeAesKey(s) || s.length > 10)) {
      best.push({ key: [k], score, decoded: s });
    }
  }

  // Try known 8-byte XOR keys from datadiv MOV.W sequence
  const known8 = [
    [0x34, 0x8c, 0xa4, 0xc5, 0x7a, 0xa7, 0x25, 0x6b],
    [0x71, 0x0b, 0x5d, 0x22, 0x21, 0x75, 0x34, 0x8c],
  ];
  for (const key of known8) {
    const dec = xorBuf(entry.data, Buffer.from(key));
    const score = isPrintable(dec);
    const s = dec.toString('ascii').replace(/[^\x20-\x7e]/g, '');
    if (score > 0.80) {
      best.push({ key, score, decoded: s });
    }
  }

  if (best.length > 0) {
    best.sort((a, b) => b.score - a.score);
    results.push({ entry, candidates: best.slice(0, 3) });
  }
}

results.forEach(r => {
  console.log(`Entry VA=0x${r.entry.va.toString(16)}, file=0x${r.entry.fileOff.toString(16)}, len=${r.entry.data.length}:`);
  r.candidates.forEach(c => {
    const keyStr = c.key.map(b => '0x'+b.toString(16).padStart(2,'0')).join(',');
    console.log(`  key=[${keyStr}] score=${c.score.toFixed(2)}: "${c.decoded}"`);
  });
  console.log('');
});

// ─── Special: try AES key recovery by looking for specific patterns ───────────
console.log('=== AES key length analysis (looking for 16, 24, or 32 byte entries) ===\n');
const aesCandidates = entries.filter(e => e.data.length >= 14 && e.data.length <= 34);
console.log(`Entries with length 14-34 bytes (likely AES key/IV): ${aesCandidates.length}`);
aesCandidates.forEach(e => {
  const hex = e.data.toString('hex');
  console.log(`  file=0x${e.fileOff.toString(16)} len=${e.data.length}: ${hex}`);
});

console.log('\n=== Trying to decode short AES-length entries with all 8-byte key combos ===\n');

// Extract all pairs of 32-bit values from literal pools as potential 64-bit XOR keys
const uint32s = [];
// Scan entire datadiv function for literal-pool like values (not branch addresses)
const DATADIV_OFFSET = 0x564c;
const DATADIV_SIZE   = 3120;
for (let i = DATADIV_OFFSET; i < DATADIV_OFFSET + DATADIV_SIZE - 3; i += 4) {
  const v = readU32LE(buf, i);
  // Exclude: near-function addresses (0x5xxx - 0x6xxx), null, tiny values
  if (v > 0x100 && v < 0x10000 && (v & 0xFF) !== 0) {
    // These could be small 32-bit values (not pointers)
    // Push as 4-byte key
    uint32s.push(v);
  }
}

// Deduplicate
const unique32 = [...new Set(uint32s)].slice(0, 50);
console.log(`Candidate 4-byte values from datadiv: ${unique32.map(v=>'0x'+v.toString(16)).join(' ')}`);
console.log('');

for (const entry of aesCandidates) {
  if (entry.data.length !== 16 && entry.data.length !== 32 && entry.data.length !== 19 && entry.data.length !== 33) continue;
  
  let bestResult = null;
  
  for (const v of unique32) {
    const key = Buffer.alloc(4);
    key.writeUInt32LE(v, 0);
    const dec = xorBuf(entry.data, key);
    const s = dec.toString('ascii').replace(/[^\x20-\x7e]/g, '·');
    const score = isPrintable(dec);
    if (score > 0.95) {
      if (!bestResult || score > bestResult.score) {
        bestResult = { key: v, score, decoded: s };
      }
    }
  }
  
  if (bestResult) {
    console.log(`Entry file=0x${entry.fileOff.toString(16)} len=${entry.data.length}:`);
    console.log(`  key=0x${bestResult.key.toString(16)} score=${bestResult.score.toFixed(2)}: "${bestResult.decoded}"`);
  }
}

// ─── Final: known-plaintext attack using "hashCode" ─────────────────────────
console.log('\n=== Known-plaintext: decode entries adjacent to "hashCode" ===\n');

// hashCode is at file 0x80c0 (VA 0xC0C0), plain text
// Entry BEFORE hashCode (entry at file 0x80a0, len=40):
// This entry spans 0x80a0 to 0x80c7 (40 bytes)
// The last 8 bytes overlap with "hashCode" plain text:
// bytes 32-39 of entry = raw bytes at 0x80c0-0x80c7 = 68 61 73 68 43 6f 64 65
// AFTER XOR → should be "hashCode" = 68 61 73 68 43 6f 64 65

const entryAt80a0 = dataRaw.slice(0x80a0-DATA_FO, 0x80c8-DATA_FO); // 40 bytes
console.log(`Entry at 0x80a0 (40 bytes): ${entryAt80a0.toString('hex')}`);
const knownPlain = Buffer.from([0x68, 0x61, 0x73, 0x68, 0x43, 0x6f, 0x64, 0x65]); // "hashCode"
const knownEnc  = entryAt80a0.slice(32, 40); // bytes at 0x80c0-0x80c7
const derivedKey = Buffer.alloc(8);
for (let j = 0; j < 8; j++) derivedKey[j] = knownEnc[j] ^ knownPlain[j];
console.log(`Known encoded at 0x80c0: ${knownEnc.toString('hex')}`);
console.log(`Known plain "hashCode": ${knownPlain.toString('hex')}`);
console.log(`Derived XOR key (bytes 32-39 of entry key): ${derivedKey.toString('hex')}`);
console.log('');

// If the key repeats with period 8, we can derive the full key
// position 32 mod 8 = 0, so these 8 bytes ARE the key
const dec80a0 = xorBuf(entryAt80a0, derivedKey);
console.log(`Decoded entry at 0x80a0 with derived key: "${dec80a0.toString('ascii').replace(/[^\x20-\x7e]/g, '·')}"`);

// Apply this key to ALL entries
console.log('\nApplying derived key to ALL entries:');
for (const e of entries) {
  const dec = xorBuf(e.data, derivedKey);
  const score = isPrintable(dec);
  if (score > 0.85) {
    const s = dec.toString('ascii').replace(/[^\x20-\x7e]/g, '·');
    console.log(`  file=0x${e.fileOff.toString(16)} len=${e.data.length} score=${score.toFixed(2)}: "${s}"`);
  }
}

// Also try: the entry might be XOR'd with a NON-repeating key
// The XOR key for position p within entry = key_byte[p mod key_len]
// If key_len = entry_len (unique key per entry), try to solve:
// For "hashCode" overlap: positions 32-39 give us key[32..39]
// If key_len is shorter, key[32 mod k] = derivedKey[0], etc.
console.log('');

// Try key periods 1 through 16 for the entry at 0x80a0
for (let klen = 1; klen <= 16; klen++) {
  const key = [];
  for (let k = 0; k < klen; k++) {
    // known: position 32+k: enc[32+k] ^ plain[k] = key[32+k mod klen] = key[(32+k) mod klen]
    // We have 8 known pairs (hashCode)
    // Key[p mod klen] = enc[p] ^ plain[p-32] for p = 32..39
    const ki = (32 + k) % klen; // which key byte
    if (k < 8) {
      key[ki] = knownEnc[k] ^ knownPlain[k];
    }
  }
  // Check if we have all key bytes determined
  if (key.filter(v => v !== undefined).length === klen) {
    const dec = xorBuf(entryAt80a0, Buffer.from(key));
    const score = isPrintable(dec);
    const s = dec.toString('ascii').replace(/[^\x20-\x7e]/g, '·');
    console.log(`  klen=${klen} key=[${key.map(b=>'0x'+(b||0).toString(16).padStart(2,'0')).join(',')}] score=${score.toFixed(2)}: "${s}"`);
  }
}

console.log('\nDone.');
