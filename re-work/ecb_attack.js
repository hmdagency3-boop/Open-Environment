'use strict';
const crypto = require('crypto');
const fs = require('fs');

// In ECB mode: P[i] = AES_K_inv(C[i])  -- no chaining, no IV!
// In CBC mode: P[i] = AES_K_inv(C[i]) XOR C[i-1]

// Known ciphertext blocks
const C0_main = Buffer.from('704bffa483e753c11b9a7d99d048106a', 'hex'); // all cEv/ responses
const C0_ok   = Buffer.from('921fd150127e4e21fb12e06678dd0c34', 'hex'); // all kh/R responses
const CT1_b1  = Buffer.from('d234af1d365b2ff0b149bb7aa0ec453a', 'hex'); // fans/islike CT1
const CT2_b1  = Buffer.from('24b75f21c8c5e4bc4fa1bfccb8ae67a2', 'hex'); // fans/islike CT2
const OKB1    = Buffer.from('62942b9016318e1d6eeffdba0f258bcb', 'hex');

// Possible P[0] values - 16 bytes each exactly
const p0_candidates = [
  Buffer.from('{"code":0,"data"', 'utf8'),   // 16 bytes
  Buffer.from('{"code":0,"msg":', 'utf8'),   // 16 bytes
  Buffer.from('{"code": 0, "dat', 'utf8'),   // 16 bytes
  Buffer.from('{"code":0, "data', 'utf8'),   // 16 bytes  
  Buffer.from('{"ret":0,"data":', 'utf8'),   // 16 bytes
  Buffer.from('{"status":0,"dat', 'utf8'),   // 16 bytes
  Buffer.from('{"result":0,"dat', 'utf8'),   // 16 bytes
  Buffer.from('{"errno":0,"data', 'utf8'),   // 16 bytes
];

function aesDecBlock(key, block) {
  try {
    const d = crypto.createDecipheriv('aes-128-ecb', key, Buffer.alloc(0));
    d.setAutoPadding(false);
    return Buffer.concat([d.update(block), d.final()]);
  } catch(e) { return null; }
}

function aesDecBlock256(key, block) {
  try {
    const d = crypto.createDecipheriv('aes-256-ecb', key, Buffer.alloc(0));
    d.setAutoPadding(false);
    return Buffer.concat([d.update(block), d.final()]);
  } catch(e) { return null; }
}

function printScore(buf) {
  if (!buf) return 0;
  let c = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 0x20 && b <= 0x7e) c++;
  }
  return c;
}

// All keys
const hexKeys = [
  '713eb1bde2574f94a88ccf2dcbd28f00',
  '5dd16a8ae3fc4cc795556bb1f041cf83',
  '4267e81c92164bad9ddd0bbfb7b5e59a',
  '98ba91efb9dd44829636cc327c7ecc2e',
  '96182c0ea78a454b92b9a2e1c89fe241',
  '884e4806d2e24091aa276ffa442cf196',
  '7c006db4520e484e851b79175691046b',
  '8dbe87afc6a240d4a0f95adfc8133982',
  '785b231238a94935a590d6514e7ee6b4',
  '3fb23ccf72a81881037835036c29f16d',
  '100d26b02f61c1b1e489184cd4db4955',
  '498b35e400dc87536461e4d6d353505c',
  '1ea53d260ecf11e7b56e00163e046a26',
  '021cc0370d824a51b7c8180485c27b38',
  '236e7ec1d4b721c997c1a5f549ebbce8',
  '45c6af3c98409b18a84451215d0bdd6e',
  '2fec6c3877b72f5cfb6fc7430b458516',
  'b167f75a566c403d8e9ac33d311a6b7c',
  'c3edf5f1f69d9bf76a4373508915a257',
  'c9dd38f1bc660ce9440d44a6876d3f5d',
  'fe416640c8e8a72734219e1847ad2547',
];

// AES-256 keys: use 32-char hex strings as 32 ASCII bytes
const hex256Keys = hexKeys.filter(k => k.length === 32).map(k => Buffer.from(k, 'ascii'));

console.log('=== ECB MODE ATTACK ===');
console.log('In ECB: P[i] = AES_K_inv(C[i]) directly, no IV!\n');

console.log('--- AES-128-ECB with hex-decoded keys ---');
hexKeys.forEach(keyHex => {
  const key = Buffer.from(keyHex, 'hex');
  
  // Try direct ECB decryption (no XOR with previous block)
  const P0_main = aesDecBlock(key, C0_main);
  const P0_ok   = aesDecBlock(key, C0_ok);
  const P1_ct1  = aesDecBlock(key, CT1_b1);
  const P1_ct2  = aesDecBlock(key, CT2_b1);
  
  const s0m = printScore(P0_main);
  const s0o = printScore(P0_ok);
  const s1  = printScore(P1_ct1);
  const s2  = printScore(P1_ct2);
  
  const total = s0m + s0o + s1 + s2;
  if (total >= 50) {
    console.log('HIT! key:', keyHex, 'scores:', s0m, s0o, s1, s2);
    console.log('  P0_main:', JSON.stringify(P0_main.toString('utf8')));
    console.log('  P0_ok  :', JSON.stringify(P0_ok.toString('utf8')));
    console.log('  P1_ct1 :', JSON.stringify(P1_ct1.toString('utf8')));
    console.log('  P1_ct2 :', JSON.stringify(P1_ct2.toString('utf8')));
  }
  
  // Check if P0 matches any known plaintext exactly
  p0_candidates.forEach(p0 => {
    if (P0_main && P0_main.equals(p0)) {
      console.log('*** EXACT P0 MATCH (ECB)! key:', keyHex);
      console.log('  P0_main =', JSON.stringify(p0.toString('utf8')));
    }
    if (P0_ok && P0_ok.equals(p0)) {
      console.log('*** EXACT P0_OK MATCH (ECB)! key:', keyHex);
      console.log('  P0_ok =', JSON.stringify(p0.toString('utf8')));
    }
  });
});

console.log('\n--- AES-256-ECB with hex strings as 32 ASCII bytes ---');
hexKeys.forEach(keyHex => {
  const key32 = Buffer.from(keyHex, 'ascii'); // 32 bytes ASCII
  if (key32.length !== 32) return;
  
  const P0_main = aesDecBlock256(key32, C0_main);
  const P0_ok   = aesDecBlock256(key32, C0_ok);
  
  p0_candidates.forEach(p0 => {
    if (P0_main && P0_main.equals(p0)) {
      console.log('*** AES-256 EXACT P0 MATCH! key:', keyHex);
      console.log('  P0_main =', JSON.stringify(p0.toString('utf8')));
    }
    if (P0_ok && P0_ok.equals(p0)) {
      console.log('*** AES-256 EXACT P0_OK MATCH! key:', keyHex);
    }
  });
});

console.log('\n--- Brute scan .so file for AES-ECB keys ---');
const so = fs.readFileSync('/home/runner/workspace/re-work/libs/lib/armeabi-v7a/libndklib-common.so');
let bestECB = { score: 0 };

for (let offset = 0; offset <= so.length - 16; offset++) {
  const key = so.slice(offset, offset + 16);
  let allSame = true;
  for (let i = 1; i < 16; i++) { if (key[i] !== key[0]) { allSame = false; break; } }
  if (allSame) continue;
  
  // ECB: no XOR with previous block!
  const P0 = aesDecBlock(key, C0_main);
  if (!P0) continue;
  const s0 = printScore(P0);
  if (s0 < 12) continue;
  
  const P1a = aesDecBlock(key, CT1_b1);
  const P1b = aesDecBlock(key, CT2_b1);
  const s1 = printScore(P1a);
  const s2 = printScore(P1b);
  const total = s0 + s1 + s2;
  
  if (total > bestECB.score) {
    bestECB = { score: total, offset, key: key.toString('hex'), s0, s1, s2, P0, P1a, P1b };
  }
  
  if (total >= 42) {
    console.log('ECB HIT at 0x' + offset.toString(16) + ' key=' + key.toString('hex'));
    console.log('  P0:', JSON.stringify(P0.toString('utf8')));
    console.log('  P1a:', JSON.stringify(P1a.toString('utf8')));
  }
  
  // Check exact P0 match
  p0_candidates.forEach(p0 => {
    if (P0.equals(p0)) {
      console.log('*** EXACT ECB MATCH at 0x' + offset.toString(16));
      console.log('  key:', key.toString('hex'));
      console.log('  P0:', JSON.stringify(p0.toString('utf8')));
      console.log('  P1a:', P1a ? JSON.stringify(P1a.toString('utf8')) : 'null');
      console.log('  P1b:', P1b ? JSON.stringify(P1b.toString('utf8')) : 'null');
    }
  });
}

console.log('\nECB scan best (score ' + bestECB.score + '/48):');
if (bestECB.key) {
  console.log('  offset: 0x' + bestECB.offset.toString(16));
  console.log('  key:', bestECB.key);
  console.log('  s0/s1/s2:', bestECB.s0, bestECB.s1, bestECB.s2);
  if (bestECB.P0)  console.log('  P0:', JSON.stringify(bestECB.P0.toString('utf8')));
  if (bestECB.P1a) console.log('  P1a:', JSON.stringify(bestECB.P1a.toString('utf8')));
  if (bestECB.P1b) console.log('  P1b:', JSON.stringify(bestECB.P1b.toString('utf8')));
}
