#!/usr/bin/env node
'use strict';
const crypto = require('crypto');
const fs = require('fs');

// ─── Parse tnetstring to get the repeated response bytes ─────────────────────
const buf = fs.readFileSync('/home/runner/workspace/attached_assets/flows_1782235851805');

function parseTns(buf, offset = 0) {
  let colon = buf.indexOf(0x3a, offset);
  if (colon === -1 || colon > offset + 10) return null;
  const len = parseInt(buf.slice(offset, colon).toString('ascii'), 10);
  if (isNaN(len)) return null;
  const ds = colon + 1, de = ds + len;
  if (de >= buf.length) return null;
  const type = buf[de];
  const data = buf.slice(ds, de);
  const next = de + 1;
  let value;
  switch (type) {
    case 0x2c: value = data; break;
    case 0x23: value = parseInt(data.toString('ascii'), 10); break;
    case 0x5e: value = parseFloat(data.toString('ascii')); break;
    case 0x21: value = data.toString('ascii') === 'true'; break;
    case 0x7e: value = null; break;
    case 0x7d: {
      const dict = {}; let pos = 0;
      while (pos < data.length) {
        const k = parseTns(data, pos); if (!k) break; pos = k.next;
        const v = parseTns(data, pos); if (!v) break; pos = v.next;
        dict[Buffer.isBuffer(k.value) ? k.value.toString() : k.value] = v.value;
      }
      value = dict; break;
    }
    case 0x5d: {
      const list = []; let pos = 0;
      while (pos < data.length) {
        const r = parseTns(data, pos); if (!r) break;
        list.push(r.value); pos = r.next;
      }
      value = list; break;
    }
    default: value = data;
  }
  return { value, next };
}

const flows = [];
let pos = 0;
while (pos < buf.length) {
  const r = parseTns(buf, pos); if (!r) break;
  flows.push(r.value); pos = r.next;
}

// ─── Extract the repeated VJMQ response bytes ────────────────────────────────
const repeatedResponses = [];
flows.forEach((flow, i) => {
  if (!flow?.response?.content || !Buffer.isBuffer(flow.response.content)) return;
  const content = flow.response.content;
  // The repeated response starts with specific bytes
  if (content.length > 10) {
    repeatedResponses.push({ flowIndex: i, content, path: flow.request?.path?.toString() || '' });
  }
});

// Find the most-repeated response
const hexCounts = {};
repeatedResponses.forEach(r => {
  const h = r.content.toString('hex');
  hexCounts[h] = (hexCounts[h] || 0) + 1;
});
const sorted = Object.entries(hexCounts).sort((a,b) => b[1]-a[1]);
const mostCommon = sorted[0];

console.log('=== Response frequency analysis ===');
sorted.forEach(([h, count]) => {
  console.log(`  count=${count} len=${h.length/2} hex=${h.slice(0,64)}...`);
});

const vjmqCT = Buffer.from(mostCommon[0], 'hex');
console.log(`\nTarget ciphertext (${vjmqCT.length} bytes):`);
console.log('  hex:', vjmqCT.toString('hex'));
console.log('  b64:', vjmqCT.toString('base64'));

// ─── AES keys ────────────────────────────────────────────────────────────────
const KEYS = {
  'E8_getDk':   Buffer.from('713eb1bde2574f94a88ccf2dcbd28f00', 'hex'),
  'E11':        Buffer.from('4267e81c92164bad9ddd0bbfb7b5e59a', 'hex'),
  'E13_getAk':  Buffer.from('98ba91efb9dd44829636cc327c7ecc2e', 'hex'),
  'E21':        Buffer.from('7c006db4520e484e851b79175691046b', 'hex'),
};

// ─── Known plaintext candidates ───────────────────────────────────────────────
// These are likely server success responses
const PLAINTEXTS = [
  '{"code":0,"msg":"ok"}',
  '{"code":200,"msg":"ok"}',
  '{"code":0,"message":"ok"}',
  '{"code":0,"msg":"success"}',
  '{"code":200,"message":"success"}',
  '{"code":0}',
  '{"code":200}',
  '{"status":0,"msg":"ok"}',
  '{"code":0,"msg":"ok","data":null}',
  '{"code":0,"data":null,"msg":"ok"}',
  '{"code":200,"data":null,"msg":"ok"}',
  '{"code":0,"msg":"","data":null}',
  // Chinese apps often use these
  '{"code":0,"msg":"成功"}',
  '{"errorCode":0}',
  '{"result":0}',
];

console.log('\n=== Known-plaintext AES key/IV brute force ===\n');

// For AES-CBC: CT[0..15] = AES_K(PT[0..15] XOR IV)
// If we know PT[0..15] and CT[0..15], we can find IV for each key:
//   decrypt(CT[0..15], key) XOR PT[0..15] = IV
// → we try decrypt one block with each key and XOR with each plaintext

function decrypt1Block(key, ctBlock) {
  // AES decrypt single block in ECB (no XOR with IV)
  const d = crypto.createDecipheriv('aes-128-ecb', key, '');
  d.setAutoPadding(false);
  return Buffer.concat([d.update(ctBlock), d.final()]);
}

const ct16 = vjmqCT.slice(0, 16);
const ct32 = vjmqCT.slice(16, 32);

console.log('First block ciphertext:', ct16.toString('hex'));
console.log('Second block ciphertext:', ct32.toString('hex'));

for (const [keyName, key] of Object.entries(KEYS)) {
  // AES-ECB decrypt first block → this gives PT[0..15] XOR IV
  const decBlock = decrypt1Block(key, ct16);
  console.log(`\nKey ${keyName}: AES_dec(CT[0..15]) = ${decBlock.toString('hex')}`);
  
  // For each plaintext, derive IV = decBlock XOR PT[0..15]
  for (const pt of PLAINTEXTS) {
    const ptBuf = Buffer.from(pt, 'utf8');
    if (ptBuf.length < 16) {
      // Pad with PKCS5
      const padded = Buffer.alloc(16, 16 - ptBuf.length);
      ptBuf.copy(padded);
      const iv = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) iv[j] = decBlock[j] ^ padded[j];
      
      // Verify: encrypt ptBuf with key+iv and check = ct16
      try {
        const e = crypto.createCipheriv('aes-128-cbc', key, iv);
        e.setAutoPadding(false);
        const enc = Buffer.concat([e.update(padded)]);
        if (enc.equals(ct16)) {
          console.log(`  ✅ MATCH! key=${keyName} pt="${pt}"`);
          console.log(`  IV = ${iv.toString('hex')}`);
          // Now decrypt full response
          const d2 = crypto.createDecipheriv('aes-128-cbc', key, iv);
          d2.setAutoPadding(true);
          try {
            const full = Buffer.concat([d2.update(vjmqCT), d2.final()]);
            console.log(`  Decrypted: ${full.toString('utf8')}`);
          } catch(e) {}
        }
      } catch(e) {}
    } else {
      // Try first 16 bytes of PT as block
      const ptBlock = ptBuf.slice(0, 16);
      const iv = Buffer.alloc(16);
      for (let j = 0; j < 16; j++) iv[j] = decBlock[j] ^ ptBlock[j];
      
      // Verify with full CBC
      try {
        const d2 = crypto.createDecipheriv('aes-128-cbc', key, iv);
        d2.setAutoPadding(true);
        const dec = Buffer.concat([d2.update(vjmqCT), d2.final()]);
        const decStr = dec.toString('utf8');
        if (decStr.startsWith('{') || decStr.startsWith('[')) {
          console.log(`  ✅ MATCH! key=${keyName} pt_guess="${pt}"`);
          console.log(`  IV = ${iv.toString('hex')}`);
          console.log(`  Decrypted: ${decStr.slice(0, 200)}`);
        }
      } catch(e) {}
    }
  }
}

// ─── ECB brute force ──────────────────────────────────────────────────────────
console.log('\n=== AES-ECB known-plaintext (no IV needed) ===\n');
for (const [keyName, key] of Object.entries(KEYS)) {
  try {
    const d = crypto.createDecipheriv('aes-128-ecb', key, '');
    d.setAutoPadding(true);
    const dec = Buffer.concat([d.update(vjmqCT), d.final()]);
    const s = dec.toString('utf8');
    const printable = s.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length / s.length;
    if (printable > 0.7 || s.includes('{') || s.includes('code')) {
      console.log(`  ✅ ECB key=${keyName} score=${printable.toFixed(2)}: ${s.slice(0,200)}`);
    }
  } catch(e) {}
}

// ─── Also check if response has a header prefix ───────────────────────────────
console.log('\n=== Testing with header offset (skip first N bytes) ===\n');
for (const offset of [1, 2, 4, 8, 12, 16]) {
  const body = vjmqCT.slice(offset);
  if (body.length % 16 !== 0) continue;
  for (const [keyName, key] of Object.entries(KEYS)) {
    for (const ivHex of ['00000000000000000000000000000000', ct16.toString('hex')]) {
      const iv = Buffer.from(ivHex, 'hex');
      try {
        const d = crypto.createDecipheriv('aes-128-cbc', key, iv);
        d.setAutoPadding(true);
        const dec = Buffer.concat([d.update(body), d.final()]);
        const s = dec.toString('utf8');
        const printable = s.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length / s.length;
        if (printable > 0.8) {
          console.log(`  ✅ offset=${offset} key=${keyName} iv=${ivHex.slice(0,8)}... score=${printable.toFixed(2)}: ${s.slice(0,150)}`);
        }
      } catch(e) {}
    }
  }
}

// ─── Print ALL response contents raw ─────────────────────────────────────────
console.log('\n=== All unique response hex (for offline analysis) ===\n');
sorted.forEach(([h, count], i) => {
  console.log(`Response #${i} (count=${count}, ${h.length/2} bytes):`);
  console.log('  ' + h);
  console.log('');
});
