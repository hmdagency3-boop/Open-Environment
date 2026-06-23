'use strict';
const crypto = require('crypto');

const C0     = Buffer.from('704bffa483e753c11b9a7d99d048106a', 'hex');
const CT1_b1 = Buffer.from('d234af1d365b2ff0b149bb7aa0ec453a', 'hex');
const CT2_b1 = Buffer.from('24b75f21c8c5e4bc4fa1bfccb8ae67a2', 'hex');
const C0_ok  = Buffer.from('921fd150127e4e21fb12e06678dd0c34', 'hex');
const OKB1   = Buffer.from('62942b9016318e1d6eeffdba0f258bcb', 'hex');

function aesDecBlock(key, block) {
  const d = crypto.createDecipheriv('aes-128-ecb', key, Buffer.alloc(0));
  d.setAutoPadding(false);
  return Buffer.concat([d.update(block), d.final()]);
}
function xor(a, b) {
  const r = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) r[i] = a[i] ^ b[i];
  return r;
}
function printScore(buf) {
  let c = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b >= 0x20 && b <= 0x7e) c++;
  }
  return c;
}

const soKeys = [
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

// Add MD5-derived keys
const words = [
  'com.ditto.mobile', 'ditto.mobile', 'sayyouditto', 'ditto',
  'ditto12345678901', 'DITTO_AES_KEY', 'juxiao', 'com.juxiao',
  'juxiao_aes', 'ditto_secret', '1d3fb23ccf72a818',
];
words.forEach(w => {
  soKeys.push(crypto.createHash('md5').update(w).digest('hex'));
  soKeys.push(crypto.createHash('md5').update(Buffer.from(w)).digest('hex'));
});

// Also try ASCII strings as keys directly (16 bytes)
const asciiKeys = [
  'com.ditto.mobile',  // exactly 16 bytes
  'sayyouditto.com!',  // 16 bytes
  'dittodittoditto!',  // 16 bytes
];
asciiKeys.forEach(s => soKeys.push(Buffer.from(s, 'ascii').toString('hex')));

console.log('=== IV-INDEPENDENT TRIPLE ATTACK ===');
console.log('P[1] = AES_inv(C[1]) XOR C[0]  -- needs ZERO knowledge of IV');
console.log('Testing', soKeys.length, 'keys...\n');

let best = { score: 0 };

soKeys.forEach(keyHex => {
  let key;
  try {
    key = Buffer.from(keyHex.slice(0, 32), 'hex');
    if (key.length !== 16) return;
  } catch(e) { return; }

  try {
    const P1_ct1 = xor(aesDecBlock(key, CT1_b1), C0);
    const P1_ct2 = xor(aesDecBlock(key, CT2_b1), C0);
    const P1_ok  = xor(aesDecBlock(key, OKB1),   C0_ok);

    const s1 = printScore(P1_ct1);
    const s2 = printScore(P1_ct2);
    const s3 = printScore(P1_ok);
    const total = s1 + s2 + s3;

    if (total > best.score) {
      best = { score: total, keyHex, s1, s2, s3, P1_ct1, P1_ct2, P1_ok };
    }

    if (s1 >= 13 && s2 >= 13 && s3 >= 13) {
      console.log('*** TRIPLE HIT! key:', keyHex);
      console.log('  fans CT1 P[1]:', JSON.stringify(P1_ct1.toString('utf8')));
      console.log('  fans CT2 P[1]:', JSON.stringify(P1_ct2.toString('utf8')));
      console.log('  ok    P[1]   :', JSON.stringify(P1_ok.toString('utf8')));
    } else if (s1 >= 13 && s2 >= 13) {
      console.log('DOUBLE HIT key:', keyHex);
      console.log('  CT1:', JSON.stringify(P1_ct1.toString('utf8')));
      console.log('  CT2:', JSON.stringify(P1_ct2.toString('utf8')));
    } else if (Math.max(s1, s2, s3) >= 14) {
      console.log('Near hit (' + s1 + '/' + s2 + '/' + s3 + ') key:', keyHex);
      console.log('  CT1:', JSON.stringify(P1_ct1.toString('utf8')));
      console.log('  CT2:', JSON.stringify(P1_ct2.toString('utf8')));
      console.log('  ok :', JSON.stringify(P1_ok.toString('utf8')));
    }
  } catch(e) {}
});

console.log('\nBest result (score ' + best.score + '/48):');
if (best.keyHex) {
  console.log('  key:', best.keyHex);
  console.log('  s1/s2/s3:', best.s1, best.s2, best.s3);
  console.log('  CT1 P[1]:', JSON.stringify(best.P1_ct1.toString('utf8')));
  console.log('  CT2 P[1]:', JSON.stringify(best.P1_ct2.toString('utf8')));
  console.log('  ok  P[1]:', JSON.stringify(best.P1_ok.toString('utf8')));
}
