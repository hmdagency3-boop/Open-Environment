'use strict';
/**
 * Ditto API Client
 * AES Key: a38e5f04f39b11ed | IV: 884e00163e02b26e
 *
 * الاستخدام:
 *   node ditto_api.js login <phone> <token_type>   تسجيل دخول (one-time)
 *   node ditto_api.js session                       عرض الـ session الحالية
 *   node ditto_api.js call <endpoint> [k=v ...]    استدعاء API (يجدد ticket تلقائياً)
 *   node ditto_api.js decrypt "<base64>"            فك تشفير يدوي
 *   node ditto_api.js encrypt "plain text"          تشفير يدوي
 *
 * دورة الـ tokens:
 *   access_token  ──(صالح 30 يوم)──►  يُستخدم لجلب ticket
 *   ticket        ──(صالح 1 ساعة)──►  يُرسل مع كل طلب
 *   auto-refresh: قبل أي call، نتحقق من ticket ونجدده إذا لزم
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

const TICKET_TTL_MS   = 55 * 60 * 1000;  // نجدد بعد 55 دقيقة (قبل الـ 60)
const ACCESS_TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000; // تنبيه بعد 29 يوم

// ─────────────────────────────────────────────────────────────────────────────
// Crypto
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────
function loadSession() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); }
  catch (e) { return {}; }
}

function saveSession(s) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2));
}

function printSession(s) {
  const now = Date.now();
  console.log('\n📁 Session:');
  console.log('  uid          :', s.uid);
  console.log('  deviceId     :', s.deviceId);
  if (s.ticket) {
    const ticketAge = s.ticket_saved_at ? Math.round((now - s.ticket_saved_at) / 60000) : '?';
    const ticketLeft = s.ticket_saved_at ? Math.round((TICKET_TTL_MS - (now - s.ticket_saved_at)) / 60000) : '?';
    console.log('  ticket       :', s.ticket);
    console.log('  ticket age   :', ticketAge + ' min  (صالح لـ ' + ticketLeft + ' دقيقة أخرى)');
  }
  if (s.access_token) {
    const atAge = s.access_token_saved_at ? Math.round((now - s.access_token_saved_at) / 86400000) : '?';
    const atLeft = s.access_token_saved_at ? Math.round((ACCESS_TOKEN_TTL_MS - (now - s.access_token_saved_at)) / 86400000) : '?';
    console.log('  access_token :', s.access_token.slice(0, 16) + '...');
    console.log('  token age    :', atAge + ' days  (صالح لـ ' + atLeft + ' يوم أخرى)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────────────────
function makeHeaders(extra = {}) {
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
    ...extra,
  };
}

function httpRaw(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const extra = body
      ? { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body).toString() }
      : {};
    const headers = makeHeaders(extra);

    const req = https.request({ hostname: HOST, port: 443, path, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        if (res.headers['content-encoding'] === 'gzip') {
          try { raw = zlib.gunzipSync(raw); } catch (e) {}
        }
        resolve({ status: res.statusCode, body: raw.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function apiCall(method, path, params = null, { silent = false } = {}) {
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

  if (!silent) console.log('\n→', method, 'https://' + HOST + path);

  const res = await httpRaw(method, fullPath, body);

  try {
    const json = JSON.parse(res.body);
    if (json.ed) {
      return JSON.parse(decrypt(json.ed));
    }
    return json;
  } catch (e) {
    console.error('❌ Parse error:', e.message, '| Raw:', res.body.slice(0, 200));
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-refresh ticket
// ─────────────────────────────────────────────────────────────────────────────
async function refreshTicket(session) {
  if (!session.access_token) throw new Error('No access_token — login first');

  console.log('🔄 Refreshing ticket...');
  const result = await apiCall('POST', '/oauth/ticket', {
    access_token: session.access_token,
    deviceId:     session.deviceId,
    issue_type:   'multi',
    uid:          session.uid,
    simCountry:   'eg',
  }, { silent: true });

  if (!result || result.code !== 200) {
    const msg = result?.message || 'Unknown error';
    if (msg.includes('update app version')) {
      throw new Error('access_token انتهت صلاحيتها — ادخل مرة أخرى بـ: node ditto_api.js login');
    }
    throw new Error('Ticket refresh failed: ' + msg);
  }

  const newTicket = result.data.tickets[0].ticket;
  session.ticket = newTicket;
  session.ticket_saved_at = Date.now();
  saveSession(session);
  console.log('✅ New ticket:', newTicket);
  return newTicket;
}

async function ensureTicket(session) {
  const now = Date.now();
  const age = now - (session.ticket_saved_at || 0);

  if (!session.ticket || age > TICKET_TTL_MS) {
    await refreshTicket(session);
  }
  return session.ticket;
}

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
async function doLogin(phone, deviceId) {
  // Ditto uses type=6 (phone login)
  // يحتاج turingToken لكن نجرب بدونه أولاً
  const params = {
    phone,
    type: '6',
    access_token: phone,
    unionId: phone,
    deviceId,
    simCountry: 'eg',
    appversion: '1.3.4.0',
  };

  console.log('→ POST /acc/third/login');
  const result = await apiCall('POST', '/acc/third/login', params, { silent: true });
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Daemon mode — يشغل في الخلفية ويجدد ticket كل 55 دقيقة
// ─────────────────────────────────────────────────────────────────────────────
async function daemonMode() {
  console.log('🤖 Daemon mode — يجدد ticket تلقائياً كل 55 دقيقة');
  console.log('   اضغط Ctrl+C للإيقاف\n');

  async function tick() {
    const session = loadSession();
    if (!session.access_token) {
      console.error('❌ No session. Run: node ditto_api.js login');
      process.exit(1);
    }
    try {
      await refreshTicket(session);
      console.log('⏰ Next refresh in 55 minutes...\n');
    } catch (e) {
      console.error('❌ Refresh error:', e.message);
    }
  }

  await tick();
  setInterval(tick, TICKET_TTL_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Known Endpoints
// ─────────────────────────────────────────────────────────────────────────────
const ENDPOINTS = {
  '/purse/query':               { method: 'GET',  desc: 'رصيد المحفظة (ذهب، ماس، عملات)' },
  '/user/v3/get':               { method: 'GET',  desc: 'بيانات المستخدم الكاملة' },
  '/banned/checkBanned':        { method: 'GET',  desc: 'هل المستخدم محظور؟' },
  '/home/v1/list':              { method: 'GET',  desc: 'قائمة البث المباشر' },
  '/home/tab/room':             { method: 'GET',  desc: 'تابات الغرف والبانرات' },
  '/gift/listV3':               { method: 'GET',  desc: 'قائمة الهدايا والأسعار' },
  '/gift/listPackage':          { method: 'GET',  desc: 'باقات الهدايا' },
  '/gift/bar/actInlet':         { method: 'GET',  desc: 'أنشطة المحل' },
  '/silvercoin/getMissionInfo': { method: 'GET',  desc: 'مهام العملات الفضية' },
  '/blind/box/list':            { method: 'GET',  desc: 'قائمة الصناديق العمياء' },
  '/explore/info':              { method: 'GET',  desc: 'صفحة الاستكشاف' },
  '/room/effects/get':          { method: 'GET',  desc: 'إعدادات التأثيرات' },
  '/sns/moment/list':           { method: 'POST', desc: 'منشورات اجتماعية' },
  '/match/cleanBusy':           { method: 'POST', desc: 'إيقاف حالة المطابقة' },
  '/acc/online':                { method: 'POST', desc: 'تسجيل online' },
};

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cmd  = args[0];

  if (!cmd || cmd === 'help') {
    console.log('\n=== Ditto API Client ===');
    console.log('Key: a38e5f04f39b11ed | IV: 884e00163e02b26e\n');
    console.log('الأوامر:');
    console.log('  login                          تسجيل دخول يدوي (أدخل access_token مباشرة)');
    console.log('  session                        عرض الـ session الحالية مع تواريخ الصلاحية');
    console.log('  refresh                        تجديد ticket يدوياً الآن');
    console.log('  daemon                         وضع الخلفية — يجدد ticket كل 55 دقيقة');
    console.log('  call <endpoint> [k=v ...]      استدعاء API (يجدد ticket تلقائياً لو لزم)');
    console.log('  decrypt "<base64>"             فك تشفير');
    console.log('  encrypt "plain text"           تشفير\n');
    console.log('Endpoints المتاحة:');
    Object.entries(ENDPOINTS).forEach(([path, info]) => {
      console.log('  ' + path.padEnd(30) + info.desc);
    });
    return;
  }

  if (cmd === 'session') {
    const s = loadSession();
    if (!s.uid) { console.log('❌ No session. Run: node ditto_api.js login'); return; }
    printSession(s);
    return;
  }

  if (cmd === 'decrypt') {
    try { console.log('Decrypted:', decrypt(args[1])); }
    catch (e) { console.error('Error:', e.message); }
    return;
  }

  if (cmd === 'encrypt') {
    console.log('Encrypted:', encrypt(args.slice(1).join(' ')));
    return;
  }

  if (cmd === 'login') {
    // تسجيل دخول يدوي — المستخدم يعطينا access_token + uid
    console.log('\n=== تسجيل دخول يدوي ===');
    console.log('أدخل البيانات من حسابك (من Frida أو مرة واحدة فقط):\n');
    const access_token = args[1];
    const uid          = args[2];
    const deviceId     = args[3] || crypto.randomBytes(16).toString('hex');

    if (!access_token || !uid) {
      console.log('الاستخدام: node ditto_api.js login <access_token> <uid> [deviceId]');
      console.log('\nأو أضف يدوياً لـ ditto_session.json:');
      console.log(JSON.stringify({
        access_token: 'TOKEN_HERE',
        uid:          'UID_HERE',
        deviceId:     crypto.randomBytes(16).toString('hex'),
        access_token_saved_at: Date.now(),
      }, null, 2));
      return;
    }

    const session = {
      access_token,
      uid,
      deviceId,
      access_token_saved_at: Date.now(),
    };
    saveSession(session);
    console.log('✅ Session saved. جاري جلب ticket...');

    try {
      await refreshTicket(session);
      printSession(loadSession());
      console.log('\n✅ جاهز! استخدم: node ditto_api.js call <endpoint>');
    } catch (e) {
      console.error('❌', e.message);
    }
    return;
  }

  if (cmd === 'refresh') {
    const session = loadSession();
    if (!session.access_token) { console.error('❌ No session'); return; }
    try {
      await refreshTicket(session);
      printSession(loadSession());
    } catch (e) {
      console.error('❌', e.message);
    }
    return;
  }

  if (cmd === 'daemon') {
    await daemonMode();
    return;
  }

  if (cmd === 'call') {
    const session = loadSession();
    if (!session.access_token) {
      console.error('❌ No session. Run: node ditto_api.js login <access_token> <uid>');
      return;
    }

    const endpoint = args[1];
    if (!endpoint) { console.error('❌ Provide an endpoint, e.g.: /purse/query'); return; }

    // ── Auto-refresh ticket if needed ───────────────────
    try {
      await ensureTicket(session);
    } catch (e) {
      console.error('❌ Ticket error:', e.message);
      return;
    }

    const freshSession = loadSession();

    const params = {
      ticket:     freshSession.ticket,
      uid:        freshSession.uid,
      deviceId:   freshSession.deviceId,
      simCountry: 'eg',
    };

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

  console.error('Unknown command:', cmd, '— run without args for help');
}

main().catch(console.error);
