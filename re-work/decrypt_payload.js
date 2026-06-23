#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

// ─── AES key candidates (hex strings decoded to raw bytes) ───────────────────
const KEY_CANDIDATES = {
  'getDk_E8_3d':   Buffer.from('713eb1bde2574f94a88ccf2dcbd28f00', 'hex'),
  'E11_0x99':      Buffer.from('4267e81c92164bad9ddd0bbfb7b5e59a', 'hex'),
  'E13_0x17':      Buffer.from('98ba91efb9dd44829636cc327c7ecc2e', 'hex'),
  'E21_0x1f':      Buffer.from('7c006db4520e484e851b79175691046b', 'hex'),
};

// Also try full 33-byte entries as keys (raw, minus last null)
const RAW_CANDIDATES = {
  'E8_raw':  Buffer.from('0a0c0e585f0c5f59580f080a095b04095c05055e5e5b0f595e5f590f055b0d0d', 'hex'),
  'E11_raw': Buffer.from('adabafaefca1a8faa0aba8afadfbf8fda0fdfdfda9fbfbfffbaefbacfcaca0f8', 'hex'),
  'E13_raw': Buffer.from('2e2f75762e267271752e737323232f252e21242174742425207420727474257217', 'hex').slice(0,32),
  'E21_raw': Buffer.from('287c2f2f297b7d2b2a2d2f7a2b272b7a272a2e7d28262e282a29262e2f2b297d', 'hex'),
};

// ─── Payloads to decrypt ─────────────────────────────────────────────────────
const PAYLOADS = {
  // From getTRtcToken (progress file)
  'getTRtcToken': 'cEv/pIPnU8Ebmn2Z0EgQasesl/RuJMn/NffZtuQw+ZDMJvcny4fL8NhM8NCennBlJOtFiqA0N1LUxvm6f0+bBhCHe7NCti6/YCrz7T60yoxxneSnHD28s+ITSeDXDT4n/Ozs0A0GekKrxAX5iCG32SCFaWE0ksi5wOrAUnFzE3kFb2KmokgNy7uUokSKvV/yBBcE/moKnZT+0t7UfpheBtmGs2ctj8oqRZDXb6Yvi7qL3lvX6Wa2/RA7dBS2RNadGzScfSY5/ozoJVeMQoxdytX1OQqcnBerZO/5hSXlgvnB2XsoSTkF0PQHG82HpFgk',
  // From FLOW 1 (oauth/ticket)
  'oauth_ticket': 'TXoX17ppJnllvs9DVWFwBAe3FiAXnp956zebV0fBMiCmCVJpXHX50AQ/cfHnWhZzuvC6YLJhaIPEH28yDKXX/3imxvUjA4kbOO3zodeyURhFv9wCaRvFuJiIIF6EGbOXEJUh3+kIow/dluFtmUdS1r/Am7Hic7IYgCMuufHT68I=',
  // From FLOW 2 (home/tab/room) - request ed
  'home_tab_room_req': 'XkPGoE4Z1r60vdAWhnSK+b7zxCyFyvJkpQGga/DLdWwSZtnxc/Ia8Um3brLiKfmvO1kx8gcCCoahXFA2wV+agu49lXofouogjX8Hmua6umB+fnRivV2JOfreMGCdALGbcn2i1f74RWUrs2XcZBgPM+9BwGicg2XVNavZPNumY0x2/BN3hqE6/7LAa2E/i1vP',
  // From FLOW 0 (third/login) - shorter one
  'third_login': 'AG7PAmrrnVhD5ycxCz9Llg6HKBk/VLlq5ekKKjeH5prnWbKzuwbhJ71Fq5mrKgBnKtZpmA5eBtcB24tXkDiLPK2vefBbiMM496zhb+4kkmpqC1K5HKnMR8fhEPF0lSGCbeuoJgttE/yvpnMNPUSaaOQwh65B0Lvue5nWhBdKxrl70ya80FVbR2Wg7+sh3f9d1xLm7MScVWUm2b1FC4DC/vDT3hBhOHJ70EvmWhwXHndP28IV/WyQGNH1grrBAGNcE7SF8iVCKKLbh9b4Yq+HZ6DO39z78IbhGZ8KaU7VpoCaZkVB6aTnCsKiKdCuduftP1RkVixeLPX1/qc54PQLfqp+lmaxEvSfT9vxMqAQXm/Mi2CpmXgCeeTeQscbaFrKONg1QCDJ05MAGvKhgyH5yFEyu/+TyaZDX7pnOf2rXnm6L3YaQgOQ5tlojg3fd/eo1NVkqLt40bWMMptdA04x117GRN7HowZ8o19EM5aXVUtWrZbAj+wJQPvcMDhJJCDx6EJLs/buuRzXPpGfMCbld/o4qphjh5xEh7M8FhaYT2Mo7+L/VNo41MocrASXl6FQ0HuP8hHo6Cl9XeIOPHGXESvsS+akzZHOsW4CM/AlVv5EM6qBq3ew2ajLnXutyn7OcmZlRYZNE7vhwusD+VfwjgI2JomFp90m3Eoc5uxhchLIjK7xapKNzC4BUVnRc+MhQYU+qf0RmXosg3o/u6BV4IG0SFkma4JUMJ+Vf1DiAqOw+qZ9sAhblL8Ljl2FV1AFnGlPUrJl9N9VjNUzMTNZ0eMS8DfDIsCVfe2PPkzei7kFanZyxv2tkLccMKaSdCfXVZTyA6/NxOw49SRMQA16hdrPS5gFviQKEIPKWmAfiZ04mLpHhj0UAyqPmzm7XAanWfGTKj5rkOETfvcAfEDqf0RFAFlfXU8UnlKjGzvcgBYQXoWgnWlNGPttFB0ueR3lhy55q1+kvbG4l5oGZfnSjmjHtg0579noWGP8ZHT6SfJA6deeHBAng/K2YB/xb/4jbVPhMqkxhqPiu8Tk9bsqVizZZo/vTrj/V+xFzl5ARrU=',
};

// ─── IV candidates ──────────────────────────────────────────────────────────
const IV_ZERO = Buffer.alloc(16, 0);

function tryDecrypt(name, ciphertextB64, keyBuf, iv, mode = 'aes-128-cbc') {
  try {
    const ct = Buffer.from(ciphertextB64, 'base64');
    if (ct.length < 16) return null;
    
    const actualIV = iv || IV_ZERO;
    const decipher = crypto.createDecipheriv(mode, keyBuf, actualIV);
    decipher.setAutoPadding(true);
    const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
    
    // Check if result is printable / JSON
    const str = dec.toString('utf8');
    const printable = str.split('').filter(c => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x7e).length;
    const score = printable / str.length;
    
    if (score > 0.70 || str.startsWith('{') || str.startsWith('[')) {
      return { score, str: str.slice(0, 200) };
    }
    return null;
  } catch(e) {
    return null;
  }
}

function tryDecryptNopad(name, ciphertextB64, keyBuf, iv, mode = 'aes-128-cbc') {
  try {
    const ct = Buffer.from(ciphertextB64, 'base64');
    if (ct.length < 16) return null;
    const actualIV = iv || IV_ZERO;
    const decipher = crypto.createDecipheriv(mode, keyBuf, actualIV);
    decipher.setAutoPadding(false);
    const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
    const str = dec.toString('utf8');
    const printable = str.split('').filter(c => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x7e).length;
    const score = printable / str.length;
    if (score > 0.70 || str.startsWith('{') || str.startsWith('[')) {
      return { score, str: str.slice(0, 200) };
    }
    return null;
  } catch(e) { return null; }
}

console.log('=== AES Decryption Attempt ===\n');

const allKeys = { ...KEY_CANDIDATES };
// Add 32-byte (AES-256) version by concatenating key pairs
for (const [n1, k1] of Object.entries(KEY_CANDIDATES)) {
  for (const [n2, k2] of Object.entries(KEY_CANDIDATES)) {
    if (n1 !== n2) {
      allKeys[`${n1}+${n2}_256`] = Buffer.concat([k1, k2]);
    }
  }
}

for (const [payloadName, payloadB64] of Object.entries(PAYLOADS)) {
  const ct = Buffer.from(payloadB64, 'base64');
  console.log(`\n── ${payloadName} (${ct.length} bytes) ──`);
  
  let found = false;
  
  for (const [keyName, keyBuf] of Object.entries(allKeys)) {
    const keyLen = keyBuf.length;
    if (keyLen !== 16 && keyLen !== 24 && keyLen !== 32) continue;
    
    const mode128 = `aes-${keyLen*8}-cbc`;
    const modeECB = `aes-${keyLen*8}-ecb`;
    
    // IV candidates:
    const ivs = [
      ['zero', IV_ZERO],
      ['ct_first16', ct.slice(0, 16)],
      // Common IVs
      ['all_zero', Buffer.alloc(16, 0x00)],
    ];
    
    // Try CBC with each IV
    for (const [ivName, iv] of ivs) {
      if (iv.length !== 16) continue;
      
      // With auto-padding
      const r1 = tryDecrypt(keyName, payloadB64, keyBuf.slice(0, keyLen), iv, mode128);
      if (r1) {
        console.log(`  ✅ CBC key=${keyName} iv=${ivName} score=${r1.score.toFixed(2)}`);
        console.log(`     Result: ${r1.str}`);
        found = true;
      }
      
      // Without padding
      const r2 = tryDecryptNopad(keyName, payloadB64, keyBuf.slice(0, keyLen), iv, mode128);
      if (r2 && r2.score > 0.85) {
        console.log(`  ✅ CBC_nopad key=${keyName} iv=${ivName} score=${r2.score.toFixed(2)}`);
        console.log(`     Result: ${r2.str}`);
        found = true;
      }
    }
    
    // Try ECB
    try {
      const ct2 = Buffer.from(payloadB64, 'base64');
      const d = crypto.createDecipheriv(modeECB, keyBuf.slice(0, keyLen), '');
      d.setAutoPadding(true);
      const dec = Buffer.concat([d.update(ct2), d.final()]);
      const str = dec.toString('utf8');
      const printable = str.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length;
      if (printable / str.length > 0.80) {
        console.log(`  ✅ ECB key=${keyName} score=${(printable/str.length).toFixed(2)}`);
        console.log(`     Result: ${str.slice(0,200)}`);
        found = true;
      }
    } catch(e) {}
  }
  
  if (!found) {
    console.log('  ❌ No readable result with current keys');
  }
}

// ─── Try with IV = 1st 16 bytes of ciphertext (ct prefix as IV) ─────────────
console.log('\n\n=== Extra: try ed=base64(iv+ciphertext) format ===\n');

for (const [payloadName, payloadB64] of Object.entries(PAYLOADS)) {
  const ct = Buffer.from(payloadB64, 'base64');
  if (ct.length < 32) continue;
  
  const iv = ct.slice(0, 16);
  const body = ct.slice(16);
  
  console.log(`\n── ${payloadName} (skip first 16 as IV) ──`);
  
  for (const [keyName, keyBuf] of Object.entries(KEY_CANDIDATES)) {
    const keyLen = keyBuf.length;
    const mode = `aes-${keyLen*8}-cbc`;
    
    try {
      const d = crypto.createDecipheriv(mode, keyBuf, iv);
      d.setAutoPadding(true);
      const dec = Buffer.concat([d.update(body), d.final()]);
      const str = dec.toString('utf8');
      const printable = str.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length;
      const score = printable / str.length;
      if (score > 0.70 || str.startsWith('{')) {
        console.log(`  ✅ key=${keyName} (using first 16 bytes as IV) score=${score.toFixed(2)}`);
        console.log(`     Result: ${str.slice(0, 200)}`);
      }
    } catch(e) {}
  }
}

// ─── Try AES-GCM (no IV in standard way, try tag at end) ─────────────────────
console.log('\n\n=== Extra: try AES-GCM ===\n');

for (const [payloadName, payloadB64] of Object.entries(PAYLOADS)) {
  const ct = Buffer.from(payloadB64, 'base64');
  if (ct.length < 28) continue; // min: 12-byte nonce + 16-byte tag
  
  // Format: nonce(12) + ciphertext + tag(16)
  const nonce = ct.slice(0, 12);
  const tag   = ct.slice(ct.length - 16);
  const body  = ct.slice(12, ct.length - 16);
  
  for (const [keyName, keyBuf] of Object.entries(KEY_CANDIDATES)) {
    const keyLen = keyBuf.length;
    const mode = `aes-${keyLen*8}-gcm`;
    try {
      const d = crypto.createDecipheriv(mode, keyBuf, nonce);
      d.setAuthTag(tag);
      const dec = Buffer.concat([d.update(body), d.final()]);
      const str = dec.toString('utf8');
      const printable = str.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length;
      if (printable / str.length > 0.70) {
        console.log(`  ✅ GCM key=${keyName} payload=${payloadName}`);
        console.log(`     Result: ${str.slice(0, 200)}`);
      }
    } catch(e) {}
  }
}

// ─── Attempt: XOR with key directly (maybe not AES at all?) ──────────────────
console.log('\n\n=== Extra: try direct XOR decryption ===\n');
for (const [payloadName, payloadB64] of Object.entries(PAYLOADS)) {
  const ct = Buffer.from(payloadB64, 'base64');
  for (const [keyName, keyBuf] of Object.entries(KEY_CANDIDATES)) {
    const dec = Buffer.alloc(ct.length);
    for (let i = 0; i < ct.length; i++) dec[i] = ct[i] ^ keyBuf[i % keyBuf.length];
    const str = dec.toString('utf8');
    const printable = str.split('').filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).length;
    if (printable / str.length > 0.80) {
      console.log(`  ✅ XOR key=${keyName} payload=${payloadName} score=${(printable/ct.length).toFixed(2)}`);
      console.log(`     Result: ${str.slice(0,200)}`);
    }
  }
}

console.log('\nDone.');
