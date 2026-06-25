/**
 * ditto_worker.js — شغّله على جهازك في مصر
 * بيتصل بـ Replit كل 3 ثواني، لو في طلب API ينفّذه بالـ IP المصري ويرجع النتيجة
 *
 * مش محتاج تفتح أي port أو تعمل firewall rules!
 *
 * الاستخدام:
 *   node ditto_worker.js
 */

'use strict';

const https  = require('https');
const crypto = require('crypto');
const zlib   = require('zlib');
const fs     = require('fs');
const path   = require('path');

// ─── الإعدادات ────────────────────────────────────────────────────────────────
const REPLIT_HOST  = 'e5976c2d-0bf9-4181-b9bf-f08d16db065b-00-3umk66t73idr8.kirk.replit.dev';
const WEBHOOK_SECRET = '9c95c0ea01ffdd3362d3b282ffb40cc54dea258b230f066a';
const SESSION_FILE = path.join(__dirname, 'ditto_session.json');
const POLL_MS      = 3000;

// ─── Ditto Crypto ─────────────────────────────────────────────────────────────
const KEY  = Buffer.from('a38e5f04f39b11ed', 'ascii');
const IV   = Buffer.from('884e00163e02b26e', 'ascii');

function encrypt(plain) {
  const e = crypto.createCipheriv('aes-128-cbc', KEY, IV);
  return Buffer.concat([e.update(Buffer.from(plain, 'utf8')), e.final()]).toString('base64');
}
function decrypt(b64) {
  let s = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const d = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
  return Buffer.concat([d.update(Buffer.from(s, 'base64')), d.final()]).toString('utf8');
}

function loadSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); }
  catch { return {}; }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function httpsReq(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        if (res.headers['content-encoding'] === 'gzip') {
          try { raw = zlib.gunzipSync(raw); } catch {}
        }
        resolve({ status: res.statusCode, body: raw.toString('utf8') });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// ─── Replit API helpers ───────────────────────────────────────────────────────
function replitGet(path) {
  return httpsReq({
    hostname: REPLIT_HOST,
    path,
    method: 'GET',
    headers: { 'x-webhook-secret': WEBHOOK_SECRET },
  });
}

function replitPost(path, data) {
  const body = JSON.stringify(data);
  return httpsReq({
    hostname: REPLIT_HOST,
    path,
    method: 'POST',
    headers: {
      'x-webhook-secret': WEBHOOK_SECRET,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body).toString(),
    },
  }, body);
}

// ─── Ditto API call (runs locally = Egyptian IP) ─────────────────────────────
function makeHeaders() {
  return {
    'simulator':      'physical',
    'language':       '1',
    'appcode':        '1030400',
    'os':             'android',
    'app':            'ditto',
    'model':          'M1908C3JGG',
    'channel':        'google_play',
    'systemlanguage': 'en',
    'appversion':     '1.3.4.0',
    'osversion':      '13',
    't':              Date.now().toString(),
    'sn':             crypto.randomBytes(4).toString('hex').slice(0, 7),
    'accept-encoding':'gzip',
    'user-agent':     'okhttp/4.12.0',
  };
}

async function dittoCall(endpoint, params, method = 'GET') {
  const session = loadSession();

  // _skipSession = don't inject expired ticket/uid (used for /oauth/ticket refresh)
  const skipSession = params._skipSession === 'true' || params._skipSession === true;
  delete params._skipSession;

  const merged = skipSession
    ? { simCountry: 'eg', ...params }
    : {
        ticket:     session.ticket   || '',
        uid:        session.uid      || '',
        deviceId:   session.deviceId || '',
        simCountry: 'eg',
        ...params,
      };

  const plain = new URLSearchParams(merged).toString();
  const enc   = encrypt(plain);

  let reqPath = endpoint;
  let body    = null;
  if (method === 'GET') {
    reqPath = endpoint + '?ed=' + encodeURIComponent(enc);
  } else {
    body = 'ed=' + encodeURIComponent(enc);
  }

  const extraHeaders = body
    ? { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body).toString() }
    : {};

  const res = await httpsReq({
    hostname: 'www.sayyouditto.com',
    port: 443,
    path: reqPath,
    method,
    headers: { ...makeHeaders(), ...extraHeaders },
  }, body);

  try {
    const json = JSON.parse(res.body);
    if (json.ed) return JSON.parse(decrypt(json.ed));
    return json;
  } catch {
    return { error: 'parse_error', raw: res.body.slice(0, 300) };
  }
}

// ─── Main poll loop ───────────────────────────────────────────────────────────
async function poll() {
  try {
    const r   = await replitGet('/api/jobs/pending');
    const obj = JSON.parse(r.body);
    if (!obj.job) return; // لا يوجد طلبات

    const { jobId, endpoint, params } = obj.job;
    const method = params._method || 'GET';
    delete params._method;

    process.stdout.write(`\n📡 Job ${jobId}: ${method} ${endpoint} ${JSON.stringify(params)}\n`);

    const result = await dittoCall(endpoint, params, method);
    process.stdout.write(`✅ Done: ${JSON.stringify(result).slice(0, 120)}\n`);

    await replitPost('/api/jobs/result', { jobId, result });
  } catch (e) {
    if (!e.message.includes('Timeout') && !e.message.includes('ECONNRESET')) {
      process.stdout.write(`⚠️  poll error: ${e.message}\n`);
    }
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║         Ditto Worker — شغّال ✅                      ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');
console.log('  بيتصل بـ Replit كل', POLL_MS / 1000, 'ثواني');
console.log('  مش محتاج تفتح أي port ✅');
console.log('');
console.log('  اضغط Ctrl+C للإيقاف');
console.log('');

// Check session
const s = loadSession();
if (s.ticket) {
  console.log('  Session: uid=' + s.uid + ' | ticket=' + s.ticket.slice(0, 8) + '...');
} else {
  console.log('  ⚠️  مفيش session — بعض الـ endpoints ممكن تفشل');
}
console.log('');

setInterval(poll, POLL_MS);
poll();
