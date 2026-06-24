'use strict';
/**
 * Ditto API Client - WORKING
 * AES Key: a38e5f04f39b11ed | IV: 884e00163e02b26e
 *
 * Usage:
 *   node ditto_api.js call /purse/query
 *   node ditto_api.js call /fans/list pageNum=1 pageSize=20
 *   node ditto_api.js decrypt "<base64>"
 *   node ditto_api.js session
 */

const crypto = require('crypto');
const https  = require('https');
const zlib   = require('zlib');
const fs     = require('fs');

const KEY  = Buffer.from('a38e5f04f39b11ed', 'ascii');
const IV   = Buffer.from('884e00163e02b26e', 'ascii');
const ALGO = 'aes-128-cbc';
const HOST = 'www.sayyouditto.com';
const SESSION_FILE = './ditto_session.json';

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
  if (!ct.length || ct.length % 16 !== 0) throw new Error(`Bad ciphertext length: ${ct.length}`);
  const d = crypto.createDecipheriv(ALGO, KEY, IV);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

// ── Session ───────────────────────────────────────────────────────────────────
function loadSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); }
  catch(e) { return {}; }
}
function saveSession(s) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2));
  console.log('\n✅ Session saved:', JSON.stringify(s, null, 2));
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
function makeHeaders(extra = {}) {
  return {
    'user-agent':      'okhttp/4.9.0',
    'accept-encoding': 'gzip',
    'content-type':    'application/x-www-form-urlencoded',
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
    'sn':              crypto.randomBytes(4).toString('hex').slice(0, 7),
    ...extra,
  };
}

function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const headers = makeHeaders();
    if (body) headers['content-length'] = Buffer.byteLength(body).toString();

    const req = https.request({ hostname: HOST, port: 443, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        if (res.headers['content-encoding'] === 'gzip') {
          try { raw = zlib.gunzipSync(raw); } catch(e) {}
        }
        resolve({ status: res.statusCode, body: raw.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function apiCall(method, path, params = null) {
  let fullPath = path;
  let body = null;

  if (params) {
    const plain = new URLSearchParams(params).toString();
    const enc = encrypt(plain);
    if (method === 'GET') {
      fullPath = path + '?ed=' + encodeURIComponent(enc);
    } else {
      body = 'ed=' + encodeURIComponent(enc);
    }
  }

  console.log(`\n→ ${method} https://${HOST}${fullPath}`);
  const res = await httpRequest(method, fullPath, body);

  // Parse and decrypt response
  try {
    const json = JSON.parse(res.body);
    if (json.ed) {
      const plain = decrypt(json.ed);
      const data = JSON.parse(plain);
      return data;
    }
    return json;
  } catch(e) {
    console.error('Response error:', e.message, '| Raw:', res.body.substring(0, 200));
    return null;
  }
}

// ── Known Endpoints ───────────────────────────────────────────────────────────
const ENDPOINTS = {
  '/purse/query':    { method: 'GET',  desc: 'رصيد المحفظة (ذهب، ماس، عملات)' },
  '/home/v2/index':  { method: 'GET',  desc: 'الصفحة الرئيسية' },
  '/fans/list':      { method: 'GET',  desc: 'قائمة المتابعين' },
  '/user/info':      { method: 'GET',  desc: 'معلومات المستخدم' },
  '/home/v2/list':   { method: 'GET',  desc: 'قائمة البث المباشر' },
  '/oauth/ticket':   { method: 'POST', desc: 'تجديد الـ ticket' },
};

// ── Commands ──────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cmd  = args[0];

  if (!cmd || cmd === 'help') {
    console.log('\n=== Ditto API Client ===');
    console.log('Key: a38e5f04f39b11ed | IV: 884e00163e02b26e\n');
    console.log('Commands:');
    console.log('  node ditto_api.js session                    عرض الـ session');
    console.log('  node ditto_api.js call <endpoint> [k=v ...]  استدعاء API');
    console.log('  node ditto_api.js decrypt "<base64>"          فك تشفير');
    console.log('  node ditto_api.js encrypt "plain text"        تشفير\n');
    console.log('Endpoints المتاحة:');
    Object.entries(ENDPOINTS).forEach(([path, info]) => {
      console.log(`  ${path.padEnd(20)} ${info.desc}`);
    });
    return;
  }

  if (cmd === 'session') {
    const s = loadSession();
    if (s.ticket) {
      console.log('✅ Session:', JSON.stringify(s, null, 2));
    } else {
      console.log('❌ No session. Get ticket from Frida output and add to', SESSION_FILE);
    }
    return;
  }

  if (cmd === 'decrypt') {
    try { console.log('Decrypted:', decrypt(args[1])); }
    catch(e) { console.error('Error:', e.message); }
    return;
  }

  if (cmd === 'encrypt') {
    console.log('Encrypted:', encrypt(args.slice(1).join(' ')));
    return;
  }

  if (cmd === 'call') {
    const session = loadSession();
    if (!session.ticket) {
      console.error('❌ No session found. Add ticket to', SESSION_FILE);
      return;
    }

    const endpoint = args[1];
    if (!endpoint) { console.error('❌ Provide an endpoint, e.g.: /purse/query'); return; }

    // Base params from session
    const params = {
      ticket:     session.ticket,
      uid:        session.uid,
      deviceId:   session.deviceId,
      simCountry: 'eg',
    };

    // Extra params from CLI
    args.slice(2).forEach(kv => {
      const [k, ...rest] = kv.split('=');
      if (k) params[k] = rest.join('=');
    });

    const info = ENDPOINTS[endpoint];
    const method = info ? info.method : 'GET';

    const result = await apiCall(method, endpoint, params);
    if (result) {
      console.log('\n✅ Response:');
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  if (cmd === 'refresh') {
    // Refresh ticket using saved access_token
    const session = loadSession();
    if (!session.access_token) {
      console.error('❌ No access_token in session');
      return;
    }
    const result = await apiCall('POST', '/oauth/ticket', {
      access_token: session.access_token,
      deviceId:     session.deviceId,
      issue_type:   'multi',
      simCountry:   'eg',
    });
    if (result && result.code === 200) {
      const ticket = result.data.tickets[0].ticket;
      session.ticket = ticket;
      saveSession(session);
      console.log('✅ New ticket:', ticket);
    } else {
      console.log('Response:', JSON.stringify(result));
    }
    return;
  }

  console.error('Unknown command:', cmd, '— run without args for help');
}

main().catch(console.error);
