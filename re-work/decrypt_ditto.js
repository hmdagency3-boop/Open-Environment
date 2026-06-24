'use strict';
/**
 * Ditto API Decryptor - CONFIRMED WORKING
 * Key captured via Frida from com.ditto.mobile
 *
 * AES/CBC/PKCS5Padding
 * Key: a38e5f04f39b11ed  (16 ASCII bytes)
 * IV:  884e00163e02b26e  (16 ASCII bytes)
 *
 * Usage:
 *   node decrypt_ditto.js "<base64_ed_value>"
 *   node decrypt_ditto.js --encrypt "plain text to encrypt"
 */

const crypto = require('crypto');

const KEY = Buffer.from('a38e5f04f39b11ed', 'ascii'); // 16 bytes
const IV  = Buffer.from('884e00163e02b26e', 'ascii'); // 16 bytes
const ALGO = 'aes-128-cbc';

function decrypt(input) {
  // Handle URL-encoded base64
  let b64 = input.trim();
  if (b64.includes('%')) b64 = decodeURIComponent(b64);
  // Handle URL-safe base64
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  // Fix padding
  while (b64.length % 4 !== 0) b64 += '=';

  const ct = Buffer.from(b64, 'base64');
  if (ct.length === 0) throw new Error('Empty ciphertext');
  if (ct.length % 16 !== 0) throw new Error(`Bad ciphertext length: ${ct.length} (not multiple of 16)`);

  const d = crypto.createDecipheriv(ALGO, KEY, IV);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

function encrypt(plain) {
  const e = crypto.createCipheriv(ALGO, KEY, IV);
  return Buffer.concat([e.update(Buffer.from(plain, 'utf8')), e.final()]).toString('base64');
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length === 0) {
  // Self-test
  console.log('=== Ditto AES Decryptor ===');
  console.log('Key:', KEY.toString('hex'), '(', KEY.toString('ascii'), ')');
  console.log('IV: ', IV.toString('hex'), '(', IV.toString('ascii'), ')');
  console.log('');

  // Verify with known ciphertext (C0 block test)
  console.log('── Verification ──────────────────────────────────────────────');
  const crypto2 = require('crypto');
  const d0 = crypto2.createDecipheriv(ALGO, KEY, IV);
  d0.setAutoPadding(false);
  const P0 = Buffer.concat([d0.update(Buffer.from('704bffa483e753c11b9a7d99d048106a','hex')), d0.final()]);
  console.log('C0 → P0:', JSON.stringify(P0.toString('utf8')));
  console.log('Expected:   {"code":200,"dat"');
  console.log('Match:', P0.toString('utf8') === '{"code":200,"dat' ? '✅ KEY IS CORRECT!' : '❌ MISMATCH');

  console.log('');
  console.log('── Round-trip test ───────────────────────────────────────────');
  const plain = '{"code":200,"data":{"uid":12345}}';
  const enc = encrypt(plain);
  const dec = decrypt(enc);
  console.log('Original:', plain);
  console.log('Encrypted:', enc);
  console.log('Decrypted:', dec);
  console.log('Round-trip:', plain === dec ? '✅' : '❌');

  console.log('');
  console.log('── Usage ─────────────────────────────────────────────────────');
  console.log('Decrypt:  node decrypt_ditto.js "<base64>"');
  console.log('Encrypt:  node decrypt_ditto.js --encrypt "plain text"');
  console.log('');

} else if (args[0] === '--encrypt') {
  const plain = args.slice(1).join(' ');
  const result = encrypt(plain);
  console.log('Encrypted:', result);

} else {
  // Decrypt mode
  const input = args.join(' ');
  try {
    const result = decrypt(input);
    console.log('Decrypted:', result);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
