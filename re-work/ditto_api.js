'use strict';
/**
 * Ditto API Client
 * استخدام APIs التطبيق خارجياً
 *
 * Usage:
 *   node ditto_api.js login <phone_or_uid> <access_token>
 *   node ditto_api.js call <endpoint> [key=value ...]
 *   node ditto_api.js decrypt <base64>
 */

const crypto = require('crypto');
const https  = require('https');
const fs     = require('fs');

// ── AES Keys (confirmed via Frida) ──────────────────────────────────────────
const KEY  = Buffer.from('a38e5f04f39b11ed', 'ascii');
const IV   = Buffer.from('884e00163e02b26e', 'ascii');
const ALGO = 'aes-128-cbc';
const HOST = 'www.sayyouditto.com';

// ── Session storage ──────────────────────────────────────────────────────────
const SESSION_FILE = './ditto_session.json';

function loadSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); }
  catch(e) { return {}; }
}
function saveSession(s) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2));
}

// ── Crypto ───────────────────────────────────────────────────────────────────
function encrypt(plain) {
  const e = crypto.createCipheriv(ALGO, KEY, IV);
  return Buffer.concat([e.update(Buffer.from(plain, 'utf8')), e.final()]).toString('base64');
}

function decrypt(b64) {
  let s = b64.trim();
  if (s.includes('%')) s = decodeURIComponent(s);
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const ct = Buffer.from(s, 'base64');
  if (ct.length === 0 || ct.length % 16 !== 0)
    throw new Error(`Bad ciphertext length: ${ct.length}`);
  const d = crypto.createDecipheriv(ALGO, KEY, IV);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
function randomSn() {
  return crypto.randomBytes(4).toString('hex').slice(0, 7);
}

function makeHeaders(extra = {}) {
  return {
    'content-type':    'application/x-www-form-urlencoded',
    'accept-encoding': 'gzip',
    'user-agent':      'okhttp/4.9.0',
    'simulator':       'physical',
    'language':        '1',
    'appcode':         '1030400',
    'os':              'android',
    'app':             'ditto',
    'model':           'Samsung SM-G988N',
    'channel':         'google_play',
    'systemlanguage':  'en',
    'appversion':      '1.3.4.0',
    'osversion':       '13',
    't':               Date.now().toString(),
    'sn':              randomSn(),
    ...extra,
  };
}

function request(method, path, bodyParams = null) {
  return new Promise((resolve, reject) => {
    // Encrypt body params if provided
    let body = null;
    if (bodyParams) {
      const plain = typeof bodyParams === 'string'
        ? bodyParams
        : new URLSearchParams(bodyParams).toString();
      const enc = encrypt(plain);
      body = 'ed=' + encodeURIComponent(enc);
    }

    const headers = makeHeaders();
    if (body) headers['content-length'] = Buffer.byteLength(body).toString();

    const opts = {
      hostname: HOST,
      port: 443,
      path,
      method,
      headers,
    };

    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        // Handle gzip
        if (res.headers['content-encoding'] === 'gzip') {
          try {
            const zlib = require('zlib');
            raw = zlib.gunzipSync(raw);
          } catch(e) {}
        }
        const text = raw.toString('utf8');
        try {
          const json = JSON.parse(text);
          // Decrypt ed field if present
          if (json.ed) {
            try {
              const plain = decrypt(json.ed);
              const parsed = JSON.parse(plain);
              resolve({ raw: json, data: parsed, path });
            } catch(e) {
              resolve({ raw: json, data: null, decryptError: e.message, path });
            }
          } else {
            resolve({ raw: json, data: json, path });
          }
        } catch(e) {
          resolve({ raw: text, data: null, path });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── API Calls ────────────────────────────────────────────────────────────────

// Step 1: Login with social access_token (type=6 = تسجيل دخول بالهاتف)
async function login(accessToken, uid = '', unionId = '') {
  console.log('\n[1] Logging in...');
  const res = await request('POST', '/acc/third/login', {
    access_token: accessToken,
    unionId:      unionId || accessToken,
    type:         '6',
    phone:        accessToken,
    turingToken:  '',
  });
  console.log('Login response:', JSON.stringify(res.data || res.raw, null, 2));

  if (res.data && res.data.code === 200) {
    const d = res.data.data;
    // Step 2: Get ticket
    await getTicket(d.access_token, d.uid, d.deviceId);
  }
  return res;
}

// Step 2: Exchange access_token for ticket
async function getTicket(accessToken, uid, deviceId) {
  console.log('\n[2] Getting ticket...');
  const res = await request('POST', '/oauth/ticket', {
    access_token: accessToken,
    deviceId:     deviceId || '27e0073c1e0d132a0b66a84ff8ada5baa',
    issue_type:   'multi',
    simCountry:   'eg',
  });
  console.log('Ticket response:', JSON.stringify(res.data || res.raw, null, 2));

  if (res.data && res.data.code === 200) {
    const session = {
      ticket:   res.data.data.ticket,
      uid:      uid,
      deviceId: deviceId || '27e0073c1e0d132a0b66a84ff8ada5baa',
    };
    saveSession(session);
    console.log('\n✅ Session saved to', SESSION_FILE);
    console.log('   ticket:', session.ticket);
    console.log('   uid:   ', session.uid);
  }
  return res;
}

// Generic API call using saved session
async function apiCall(endpoint, extraParams = {}) {
  const session = loadSession();
  if (!session.ticket) {
    console.error('❌ No session found. Run: node ditto_api.js login <token>');
    return;
  }

  const params = {
    ticket:   session.ticket,
    uid:      session.uid,
    deviceId: session.deviceId,
    simCountry: 'eg',
    ...extraParams,
  };

  const method = endpoint.includes('?') || Object.keys(extraParams).length === 0 ? 'GET' : 'POST';
  const path = method === 'GET'
    ? endpoint + '?ed=' + encodeURIComponent(encrypt(new URLSearchParams(params).toString()))
    : endpoint;

  console.log(`\n[API] ${method} ${path}`);
  const res = await method === 'GET'
    ? request('GET', path)
    : request('POST', path, params);

  console.log('Response:', JSON.stringify(res.data || res.raw, null, 2));
  return res;
}

// ── CLI ───────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cmd  = args[0];

  if (!cmd || cmd === 'help') {
    console.log(`
Ditto API Client — Commands:
  login <access_token>          تسجيل دخول وحفظ الـ session
  call <endpoint> [k=v ...]    استدعاء أي API endpoint
  decrypt <base64>              فك تشفير أي ed value
  session                       عرض الـ session المحفوظ

Examples:
  node ditto_api.js login 20-01113496139
  node ditto_api.js call /home/v2/index
  node ditto_api.js call /purse/query
  node ditto_api.js call /fans/list pageNum=1 pageSize=20
  node ditto_api.js decrypt "kh/RUBJ+TiH7EuBmeN0MN..."
    `);
    return;
  }

  if (cmd === 'decrypt') {
    try {
      const result = decrypt(args[1]);
      console.log('Decrypted:', result);
    } catch(e) { console.error('Error:', e.message); }
    return;
  }

  if (cmd === 'session') {
    const s = loadSession();
    console.log(s.ticket ? '✅ Session loaded:' : '❌ No session:', JSON.stringify(s, null, 2));
    return;
  }

  if (cmd === 'login') {
    await login(args[1], args[2], args[3]);
    return;
  }

  if (cmd === 'call') {
    const endpoint = args[1];
    const extra = {};
    args.slice(2).forEach(kv => {
      const [k, v] = kv.split('=');
      if (k && v !== undefined) extra[k] = v;
    });
    await apiCall(endpoint, extra);
    return;
  }

  console.error('Unknown command:', cmd);
}

main().catch(console.error);
