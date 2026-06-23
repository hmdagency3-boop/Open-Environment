#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SO_PATH = path.join(__dirname, 'libs/lib/armeabi-v7a/libndklib-common.so');
const buf = fs.readFileSync(SO_PATH);

// ─── ELF constants ───────────────────────────────────────────────────────────
const DATA_FILE_OFFSET = 0x8000;
const DATA_SIZE        = 0x421;          // 1057 bytes
const DATADIV_OFFSET   = 0x564c;
const DATADIV_SIZE     = 3120;

// Virtual address of .data section (needed to match addresses inside the fn)
const DATA_VA          = 0xc000;        // from ELF header analysis

// ─── Extract raw bytes ───────────────────────────────────────────────────────
const dataRaw    = Buffer.from(buf.slice(DATA_FILE_OFFSET, DATA_FILE_OFFSET + DATA_SIZE));
const dataCopy   = Buffer.from(dataRaw);   // we'll modify this copy
const fnBytes    = buf.slice(DATADIV_OFFSET, DATADIV_OFFSET + DATADIV_SIZE);

console.log('=== datadiv_decode XOR analyzer ===');
console.log(`Function: ${DATADIV_SIZE} bytes @ 0x${DATADIV_OFFSET.toString(16)}`);
console.log(`.data   : ${DATA_SIZE} bytes @ 0x${DATA_FILE_OFFSET.toString(16)}  (VA=0x${DATA_VA.toString(16)})`);
console.log('');

// ─── ARM Thumb-2 instruction parser ──────────────────────────────────────────
// We look for the following patterns that datadiv uses to load XOR keys:
//
//  MOV.W Rd, #imm8           F0 4F imm8 0N  (modified immediate)
//  MOVW  Rd, #imm16          F2 40..4F xxxx
//  MOVT  Rd, #imm16          F2 C0..CF xxxx
//  EOR / EORS (Thumb-16)     40 4x
//  EOR.W (Thumb-32)          EA 80..8F xxxx

function readU16LE(b, off) { return b[off] | (b[off+1] << 8); }
function readU32LE(b, off) { return (b[off] | (b[off+1]<<8) | (b[off+2]<<16) | (b[off+3]<<24)) >>> 0; }

// Decode MOVW immediate from two Thumb-2 halfwords
function decodeMOVW(hw1, hw2) {
  // hw1 = 0xF2_4x  or  0xF2_4y  (first 16-bit halfword, little-endian from memory)
  // F240 xxxx  → MOVW Rd, #imm16
  //   imm4  = hw1[3:0]
  //   i     = hw1[10]
  //   imm3  = hw2[14:12]
  //   imm8  = hw2[7:0]
  //   Rd    = hw2[11:8]
  const imm4 = hw1 & 0xF;
  const i    = (hw1 >> 10) & 1;
  const imm3 = (hw2 >> 12) & 0x7;
  const imm8 = hw2 & 0xFF;
  const Rd   = (hw2 >> 8) & 0xF;
  const imm16 = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8;
  return { Rd, imm16 };
}

// Decode MOVT immediate (same bit layout, different opcode)
function decodeMOVT(hw1, hw2) {
  const imm4  = hw1 & 0xF;
  const i     = (hw1 >> 10) & 1;
  const imm3  = (hw2 >> 12) & 0x7;
  const imm8  = hw2 & 0xFF;
  const Rd    = (hw2 >> 8) & 0xF;
  const imm16 = (imm4 << 12) | (i << 11) | (imm3 << 8) | imm8;
  return { Rd, imm16 };
}

// Decode MOV.W Rd, #modified-immediate  (F04F xxxx)
// For simple case (no rotation): imm8 in bits [7:0] of hw2, Rd in [11:8]
function decodeMOVW_modimm(hw1, hw2) {
  // F04F = MOV.W with modified immediate (S=0, Rn=1111)
  // encoding T2: 11110 i 00010 S 1111  0 imm3 Rd imm8
  const i    = (hw1 >> 10) & 1;
  const imm3 = (hw2 >> 12) & 0x7;
  const imm8 = hw2 & 0xFF;
  const Rd   = (hw2 >> 8) & 0xF;
  // simplified: treat as imm8 for i=0,imm3=0
  const val  = (i === 0 && imm3 === 0) ? imm8 : null;
  return { Rd, val, raw: (i << 11) | (imm3 << 8) | imm8 };
}

// Parse EOR.W  EA 80..8F xxxx
// EOR.W Rd, Rn, Rm  →  no immediate; skip these (register-register XOR)
// We care about: EORS Rn, Rm  (Thumb-16: 01000001 xxxx xxxx = 0x4040 range)

// ─── Scan function bytes for instruction patterns ─────────────────────────────
console.log('=== Scanning ARM Thumb-2 instructions ===');
console.log('');

const regs   = new Array(16).fill(0);   // simulated register file
const movwSeen = {};                     // reg → last MOVW value
const movtSeen = {};                     // reg → last MOVT value
const reg32  = {};                       // reg → combined 32-bit value after MOVW+MOVT

const constants = [];   // all 32-bit values assembled from MOVW(+MOVT) pairs
const movwOnly  = [];   // values from MOVW alone (no MOVT)
const modImm    = [];   // values from MOV.W #imm8

// LDR PC-relative loads (Thumb-16: 01001 Rd imm8  = 0x48xx..0x4Fxx)
// → used to load .data addresses
const ldrPCAddrs = [];

let i = 0;
while (i < fnBytes.length - 1) {
  const hw1 = readU16LE(fnBytes, i);

  // ── Thumb-16: LDR Rd, [PC, #imm8*4]  (0x48xx – 0x4Fxx) ─────────────────
  if ((hw1 & 0xF800) === 0x4800) {
    const Rd   = (hw1 >> 8) & 0x7;
    const imm8 = hw1 & 0xFF;
    // PC for Thumb = instruction_addr + 4, aligned to 4
    const pc   = (DATADIV_OFFSET + i + 4) & ~3;
    const tgt  = pc + imm8 * 4;
    if (tgt < buf.length - 3) {
      const val = readU32LE(buf, tgt);
      ldrPCAddrs.push({ off: i, Rd, tgt: tgt.toString(16), val: val.toString(16) });
      regs[Rd] = val;
    }
    i += 2;
    continue;
  }

  // ── All 32-bit Thumb-2 instructions start with 0xE8xx–0xFFxx ────────────
  if (hw1 < 0xE000) { i += 2; continue; }
  if (i + 3 >= fnBytes.length) { i += 2; continue; }
  const hw2 = readU16LE(fnBytes, i + 2);

  // ── MOVW: F2 40..4F (first byte = 0xF2, second byte = 0x40..0x4F) ───────
  // In little-endian storage: bytes are [40..4F, F2, ...]
  // hw1 stored LE: byte0 | (byte1<<8) → byte1=0xF2, byte0=0x40..0x4F
  if ((hw1 & 0xFBF0) === 0xF240) {
    const { Rd, imm16 } = decodeMOVW(hw1, hw2);
    movwSeen[Rd] = imm16;
    delete movtSeen[Rd];
    i += 4; continue;
  }

  // ── MOVT: F2 C0..CF ──────────────────────────────────────────────────────
  if ((hw1 & 0xFBF0) === 0xF2C0) {
    const { Rd, imm16 } = decodeMOVT(hw1, hw2);
    if (movwSeen[Rd] !== undefined) {
      const val32 = ((imm16 << 16) | movwSeen[Rd]) >>> 0;
      reg32[Rd] = val32;
      constants.push({ Rd, val32, off: i });
    }
    movtSeen[Rd] = imm16;
    i += 4; continue;
  }

  // ── MOV.W Rd, #modimm  (F0 4F xxxx) ─────────────────────────────────────
  // hw1 LE: low=0x4F, high=0xF0 → hw1 = 0xF04F
  if ((hw1 & 0xFFFF) === 0xF04F) {
    const { Rd, val } = decodeMOVW_modimm(hw1, hw2);
    if (val !== null) {
      modImm.push({ Rd, val, off: i });
    }
    i += 4; continue;
  }

  // ── MOVW without matching MOVT → collect standalone ─────────────────────
  // (already handled above, but emit after loop)

  i += 4;
}

// Collect MOVW-only (no MOVT seen)
for (const [Rd, imm16] of Object.entries(movwSeen)) {
  if (movtSeen[Rd] === undefined) {
    movwOnly.push({ Rd: Number(Rd), imm16 });
  }
}

console.log(`MOVW+MOVT pairs (32-bit constants): ${constants.length}`);
constants.slice(0, 30).forEach(c =>
  console.log(`  R${c.Rd} = 0x${c.val32.toString(16).padStart(8,'0')}  @ fn+0x${c.off.toString(16)}`));
if (constants.length > 30) console.log(`  ... and ${constants.length-30} more`);

console.log('');
console.log(`MOV.W #imm8 values: ${modImm.length}`);
modImm.slice(0, 20).forEach(m =>
  console.log(`  R${m.Rd} = 0x${m.val.toString(16).padStart(2,'0')}  @ fn+0x${m.off.toString(16)}`));

console.log('');
console.log(`LDR PC-relative loads: ${ldrPCAddrs.length}`);
ldrPCAddrs.slice(0, 20).forEach(l =>
  console.log(`  R${l.Rd} ← [0x${l.tgt}] = 0x${l.val}`));

// ─── Strategy 2: look for XOR key blocks directly ────────────────────────────
// In OLLVM datadiv, XOR constants appear as consecutive 8-byte groups
// loaded into registers then applied byte-by-byte.
// The constants table sometimes appears at the END of the function as
// a literal pool.  We already know 0x624c–0x627c is the branch table.
// Look for 8-byte groups (2x 32-bit) that together form candidate keys.

console.log('');
console.log('=== Strategy 2: Extract 64-bit XOR key candidates from literal pools ===');

// Known literal pools we've seen:
//   0x5a40–0x5a50  (inside fn): a4 69 / a4 68 / 45 68 / 52 67 / bc 66
//   0x5e7e–0x5eac  (branch table inside fn)
//   0x624c–0x627c  (another branch table)
// These are addresses → not XOR keys.
//
// Real XOR keys would be: non-address 32-bit values, likely combined
// as MOVW+MOVT pairs OR loaded from a literal pool.
//
// The MOV.W #imm8 values ARE the XOR keys applied byte-by-byte!
// datadiv encodes byte-by-byte with an 8-byte repeating key.
// Each MOV.W loads one byte of the key.

// ─── Strategy 3: Identify XOR byte sequences ─────────────────────────────────
// Pattern in datadiv ARM Thumb:
//   MOV.W  Rx, #key_byte      ← F04F or MOVW
//   LDRB   Ry, [addr]         ← load encoded byte
//   EOR    Rz, Rx, Ry         ← XOR
//   STRB   Rz, [addr]         ← store decoded byte
//   ADD    addr, #1            ← next byte
// 
// OR vectorized with NEON:
//   VDUP.8 Q0, Rx             ← broadcast key byte to vector
//   VLD1   Q1, [addr]         ← load 8/16 encoded bytes
//   VEOR   Q2, Q0, Q1         ← XOR
//   VST1   Q2, [addr]         ← store

// The MOV.W imm8 sequence gives us the key bytes!
// Let's collect them in order and group into 8-byte keys.
console.log('');
console.log('MOV.W imm8 sequence (potential XOR key bytes in order):');
const keyBytes = modImm.map(m => m.val);
console.log(keyBytes.map(b => '0x'+b.toString(16).padStart(2,'0')).join(' '));

// Try grouping into 8-byte keys
if (keyBytes.length >= 8) {
  console.log('');
  console.log('Possible 8-byte XOR keys (grouped by 8):');
  for (let k = 0; k + 8 <= keyBytes.length; k += 8) {
    const group = keyBytes.slice(k, k+8);
    console.log(`  Key ${k/8}: [${group.map(b=>'0x'+b.toString(16).padStart(2,'0')).join(', ')}]`);
  }
}

// ─── Strategy 4: Full simulation with byte-level XOR ─────────────────────────
// We know the XOR key must produce ASCII/printable strings.
// Let's try ALL 32-bit constants from MOVW+MOVT and all modImm values
// as repeating-byte keys against each .data entry.

console.log('');
console.log('=== Strategy 4: Brute-force .data entries with candidate keys ===');
console.log('');

// Parse .data entries (null-padded, each ends with 0x00+ then next entry)
function parseDataEntries(data) {
  const entries = [];
  let pos = 0;
  while (pos < data.length) {
    // Find next non-null run
    if (data[pos] === 0) { pos++; continue; }
    const start = pos;
    // Find end of entry (hit null OR end)
    while (pos < data.length && data[pos] !== 0) pos++;
    const entry = data.slice(start, pos);
    entries.push({ offset: start, data: entry });
  }
  return entries;
}

// Check if a buffer is printable ASCII (>50% printable chars)
function isPrintableish(buf) {
  let printable = 0;
  for (const b of buf) {
    if (b >= 0x20 && b <= 0x7e) printable++;
    else if (b === 0x0a || b === 0x0d) printable++;
    else if (b === 0) break;
  }
  return printable / buf.length;
}

// XOR a buffer with a repeating key
function xorWith(src, key) {
  const out = Buffer.alloc(src.length);
  for (let j = 0; j < src.length; j++) {
    out[j] = src[j] ^ key[j % key.length];
  }
  return out;
}

const entries = parseDataEntries(dataRaw);
console.log(`Found ${entries.length} .data entries:`);
entries.forEach((e, i) => {
  const preview = e.data.toString('hex').slice(0, 32) + '...';
  console.log(`  Entry ${i}: offset=0x${(DATA_FILE_OFFSET+e.offset).toString(16)}, len=${e.data.length}, hex=${preview}`);
});

// Candidate XOR keys to try:
// 1) Each 32-bit constant as 4-byte repeating key
// 2) Pairs of 32-bit constants as 8-byte key
// 3) modImm bytes grouped
// 4) Common strings: "ditto", "juxiao", "AES", common Android prefixes
// 5) Single-byte keys 0x00–0xFF

const candidateKeys = new Set();

// From MOVW+MOVT constants
for (const c of constants) {
  const k = Buffer.alloc(4);
  k.writeUInt32LE(c.val32, 0);
  candidateKeys.add(k.toString('hex'));
}

// From modImm (single-byte repeating)
for (const m of modImm) {
  candidateKeys.add(Buffer.from([m.val]).toString('hex'));
}

// All single bytes 0x00–0xFF
for (let b = 0; b < 256; b++) {
  candidateKeys.add(Buffer.from([b]).toString('hex'));
}

// Common strings
const commonStr = ['ditto','juxiao','jni','AES_','KEY_','SEC_','live','match'];
for (const s of commonStr) {
  candidateKeys.add(Buffer.from(s).toString('hex'));
}

console.log('');
console.log(`Testing ${candidateKeys.size} candidate keys against all entries...`);
console.log('');

const results = [];
for (const keyHex of candidateKeys) {
  const key = Buffer.from(keyHex, 'hex');
  for (const entry of entries) {
    if (entry.data.length < 4) continue;
    const dec = xorWith(entry.data, key);
    const score = isPrintableish(dec);
    if (score > 0.85) {
      results.push({
        keyHex,
        offset: entry.offset,
        len: entry.data.length,
        score,
        decoded: dec.toString('ascii').replace(/[^\x20-\x7e]/g, '·')
      });
    }
  }
}

// Sort by score descending
results.sort((a, b) => b.score - a.score);

if (results.length === 0) {
  console.log('No high-score results. Showing top 30 by score ≥ 0.6:');
  const r2 = [];
  for (const keyHex of candidateKeys) {
    const key = Buffer.from(keyHex, 'hex');
    for (const entry of entries) {
      if (entry.data.length < 4) continue;
      const dec = xorWith(entry.data, key);
      const score = isPrintableish(dec);
      if (score >= 0.60) r2.push({ keyHex, offset: entry.offset, len: entry.data.length, score,
        decoded: dec.toString('ascii').replace(/[^\x20-\x7e]/g, '·') });
    }
  }
  r2.sort((a,b) => b.score - a.score);
  r2.slice(0, 30).forEach(r =>
    console.log(`  score=${r.score.toFixed(2)} key=0x${r.keyHex} off=0x${(DATA_FILE_OFFSET+r.offset).toString(16)} len=${r.len}: "${r.decoded}"`));
} else {
  console.log(`Found ${results.length} high-confidence decodes:`);
  // Deduplicate by decoded string
  const seen = new Set();
  let shown = 0;
  for (const r of results) {
    const dk = r.decoded.trim();
    if (seen.has(dk)) continue;
    seen.add(dk);
    console.log(`  score=${r.score.toFixed(2)} key=0x${r.keyHex} off=0x${(DATA_FILE_OFFSET+r.offset).toString(16)} len=${r.len}: "${r.decoded}"`);
    if (++shown > 50) { console.log('  ... (truncated)'); break; }
  }
}

// ─── Strategy 5: Analyse each entry's XOR key via frequency / IC analysis ────
console.log('');
console.log('=== Strategy 5: Index-of-Coincidence analysis per entry ===');
console.log('(Best key length = highest IC)');
console.log('');

function ic(data, keyLen) {
  // Sum IC across key positions
  let total = 0;
  for (let pos = 0; pos < keyLen; pos++) {
    const freq = new Array(256).fill(0);
    let count = 0;
    for (let j = pos; j < data.length; j += keyLen) {
      freq[data[j]]++;
      count++;
    }
    if (count < 2) continue;
    let sum = 0;
    for (const f of freq) sum += f * (f - 1);
    total += sum / (count * (count - 1));
  }
  return total / keyLen;
}

for (const entry of entries) {
  if (entry.data.length < 8) continue;
  const scores = [];
  for (let kl = 1; kl <= Math.min(16, entry.data.length / 2); kl++) {
    scores.push({ kl, ic: ic(entry.data, kl) });
  }
  scores.sort((a, b) => b.ic - a.ic);
  const best = scores[0];
  
  // Try to recover key using frequency analysis at best key length
  const key = [];
  for (let pos = 0; pos < best.kl; pos++) {
    const bytes = [];
    for (let j = pos; j < entry.data.length; j += best.kl) bytes.push(entry.data[j]);
    // Find XOR byte that maximizes printable ASCII
    let bestByte = 0, bestPrint = 0;
    for (let b = 0; b < 256; b++) {
      const dec = bytes.map(x => x ^ b);
      const pr = dec.filter(x => x >= 0x20 && x <= 0x7e).length / dec.length;
      if (pr > bestPrint) { bestPrint = pr; bestByte = b; }
    }
    key.push(bestByte);
  }
  
  const dec = xorWith(entry.data, Buffer.from(key));
  const score = isPrintableish(dec);
  const decoded = dec.toString('ascii').replace(/[^\x20-\x7e]/g, '·');
  console.log(`  Entry off=0x${(DATA_FILE_OFFSET+entry.offset).toString(16)} len=${entry.data.length}`);
  console.log(`    Best key len=${best.kl} (IC=${best.ic.toFixed(4)})`);
  console.log(`    Key bytes: [${key.map(b=>'0x'+b.toString(16).padStart(2,'0')).join(', ')}]`);
  console.log(`    Decoded (score=${score.toFixed(2)}): "${decoded}"`);
  console.log('');
}

// ─── Strategy 6: Try to read XOR key pairs from the literal pool ─────────────
// Looking at 0x5a40–0x5a50 in the function (fn offset 0x5a40-0x564c = 0x3f4)
// fn+0x3f4 = bytes: a4 69 00 00 / a4 68 00 00 / 45 68 00 00 / 52 67 00 00
// These are small addresses (0x69a4, 0x68a4, 0x6845, 0x6752) → addresses IN the fn
// Real literal pool: look elsewhere

// Let's look at what the LDR PC-relative loads actually loaded
console.log('=== Strategy 6: LDR PC-relative loaded values ===');
ldrPCAddrs.forEach(l => {
  // Interpret val as .data relative address  
  const va = parseInt(l.val, 16);
  const inData = (va >= DATA_VA && va < DATA_VA + DATA_SIZE);
  console.log(`  fn+0x${(DATADIV_OFFSET + parseInt(l.off)).toString(16)} R${l.Rd} ← [0x${l.tgt}] = 0x${l.val}${inData ? ' ← .DATA ADDRESS' : ''}`);
});

console.log('');
console.log('Done.');
