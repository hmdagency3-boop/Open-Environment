'use strict';
const crypto = require('crypto');
const fs = require('fs');

// Known ciphertext blocks (IV-independent: P[1] = AES_inv(C[1]) XOR C[0])
const C0     = Buffer.from('704bffa483e753c11b9a7d99d048106a', 'hex');
const CT1_b1 = Buffer.from('d234af1d365b2ff0b149bb7aa0ec453a', 'hex'); // fans/islike CT1
const CT2_b1 = Buffer.from('24b75f21c8c5e4bc4fa1bfccb8ae67a2', 'hex'); // fans/islike CT2
const C0_ok  = Buffer.from('921fd150127e4e21fb12e06678dd0c34', 'hex');
const OKB1   = Buffer.from('62942b9016318e1d6eeffdba0f258bcb', 'hex'); // ok response

function aesDecBlock(key, block) {
  try {
    const d = crypto.createDecipheriv('aes-128-ecb', key, Buffer.alloc(0));
    d.setAutoPadding(false);
    return Buffer.concat([d.update(block), d.final()]);
  } catch(e) { return null; }
}
function xor(a, b) {
  const r = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) r[i] = a[i] ^ b[i];
  return r;
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

// Load the .so file
const soPath = '/home/runner/workspace/re-work/libs/lib/armeabi-v7a/libndklib-common.so';
const so = fs.readFileSync(soPath);
console.log('SO file size:', so.length, 'bytes');
console.log('Scanning', so.length - 16, 'potential 16-byte keys...\n');

let best = { score: 0 };
const THRESHOLD = 38; // out of 48 = 79% for all 3 blocks

let checked = 0;
for (let offset = 0; offset <= so.length - 16; offset++) {
  const key = so.slice(offset, offset + 16);
  
  // Quick pre-filter: AES-128 keys should have some entropy
  // Skip if all bytes are 0 or all same
  let allSame = true;
  for (let i = 1; i < 16; i++) {
    if (key[i] !== key[0]) { allSame = false; break; }
  }
  if (allSame) continue;
  
  const P1_ct1 = aesDecBlock(key, CT1_b1);
  if (!P1_ct1) continue;
  const s1 = printScore(xor(P1_ct1, C0));
  if (s1 < 11) continue; // fast pre-filter
  
  const P1_ct2 = aesDecBlock(key, CT2_b1);
  const P1_ok  = aesDecBlock(key, OKB1);
  if (!P1_ct2 || !P1_ok) continue;
  
  const r1 = xor(P1_ct1, C0);
  const r2 = xor(P1_ct2, C0);
  const r3 = xor(P1_ok,  C0_ok);
  
  const s2 = printScore(r2);
  const s3 = printScore(r3);
  const total = s1 + s2 + s3;
  
  if (total > best.score) {
    best = { score: total, offset, key: key.toString('hex'), s1, s2, s3, r1, r2, r3 };
  }
  
  if (total >= THRESHOLD) {
    console.log('*** HIT! offset=0x' + offset.toString(16) + ' key=' + key.toString('hex'));
    console.log('  s1/s2/s3:', s1, s2, s3, '(total', total + ')');
    console.log('  CT1 P[1]:', JSON.stringify(r1.toString('utf8')));
    console.log('  CT2 P[1]:', JSON.stringify(r2.toString('utf8')));
    console.log('  ok  P[1]:', JSON.stringify(r3.toString('utf8')));
  }
  
  checked++;
}

console.log('\nScan complete. Checked', checked, 'key candidates.');
console.log('Best result (score ' + best.score + '/48):');
if (best.key) {
  console.log('  offset: 0x' + best.offset.toString(16));
  console.log('  key:   ', best.key);
  console.log('  s1/s2/s3:', best.s1, best.s2, best.s3);
  console.log('  CT1 P[1]:', JSON.stringify(best.r1.toString('utf8')));
  console.log('  CT2 P[1]:', JSON.stringify(best.r2.toString('utf8')));
  console.log('  ok  P[1]:', JSON.stringify(best.r3.toString('utf8')));
}
