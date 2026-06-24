'use strict';
/**
 * Ditto API Client — re-work/ditto_api.js
 * AES Key: a38e5f04f39b11ed | IV: 884e00163e02b26e
 *
 * الاستخدام:
 *   node re-work/ditto_api.js session                       عرض الـ session الحالية
 *   node re-work/ditto_api.js login <access_token> <uid>    حفظ session
 *   node re-work/ditto_api.js setup-push <url> <secret>     ربط Replit للـ auto-push
 *   node re-work/ditto_api.js refresh                       تجديد ticket يدوياً
 *   node re-work/ditto_api.js refresh-push                  تجديد + بعت لـ Replit مرة واحدة
 *   node re-work/ditto_api.js daemon                        تجديد ticket كل 55 دقيقة (محلي فقط)
 *   node re-work/ditto_api.js daemon-push                   تجديد + بعت لـ Replit كل 55 دقيقة ✅
 *   node re-work/ditto_api.js call <endpoint> [k=v ...]     استدعاء API
 *   node re-work/ditto_api.js decrypt "<base64>"            فك تشفير
 *   node re-work/ditto_api.js encrypt "plain text"          تشفير
 *
 * ⚠️  ملاحظة الـ version-lock:
 *   بعض الـ endpoints ترجع 10003 "Please update app version" عند الاستدعاء من Replit
 *   بسبب CDN geo-routing — نفس الـ endpoints تعمل من NOX/Android محلياً.
 */

const crypto = require('crypto');
const https  = require('https');
const zlib   = require('zlib');
const fs     = require('fs');
const path   = require('path');

const KEY  = Buffer.from('a38e5f04f39b11ed', 'ascii');
const IV   = Buffer.from('884e00163e02b26e', 'ascii');
const ALGO = 'aes-128-cbc';
const HOST = 'www.sayyouditto.com';
const SESSION_FILE = path.join(__dirname, 'ditto_session.json');

const TICKET_TTL_MS       = 55 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000;

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
    const ticketAge  = s.ticket_saved_at ? Math.round((now - s.ticket_saved_at) / 60000) : '?';
    const ticketLeft = s.ticket_saved_at ? Math.round((TICKET_TTL_MS - (now - s.ticket_saved_at)) / 60000) : '?';
    console.log('  ticket       :', s.ticket);
    console.log('  ticket age   :', ticketAge + ' min  (صالح لـ ' + ticketLeft + ' دقيقة أخرى)');
  }
  if (s.access_token) {
    const atAge  = s.access_token_saved_at ? Math.round((now - s.access_token_saved_at) / 86400000) : '?';
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

function httpRaw(method, reqPath, body = null) {
  return new Promise((resolve, reject) => {
    const extra = body
      ? { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body).toString() }
      : {};
    const headers = makeHeaders(extra);

    const req = https.request({ hostname: HOST, port: 443, path: reqPath, method, headers }, res => {
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

async function apiCall(method, endpoint, params = null, { silent = false } = {}) {
  let fullPath = endpoint;
  let body = null;

  if (params) {
    const plain = new URLSearchParams(params).toString();
    const enc = encrypt(plain);
    if (method === 'GET') {
      fullPath = endpoint + '?ed=' + encodeURIComponent(enc);
    } else {
      body = 'ed=' + encodeURIComponent(enc);
    }
  }

  if (!silent) console.log('\n→', method, 'https://' + HOST + endpoint);

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
    simCountry:   'eg',
  }, { silent: true });

  if (!result || result.code !== 200) {
    const msg = result?.message || 'Unknown error';
    throw new Error('Ticket refresh failed: ' + msg + ' (code ' + result?.code + ')');
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
// Push ticket to Replit webhook
// ─────────────────────────────────────────────────────────────────────────────
async function pushToReplit(ticket, session) {
  const cfg = session._replit;
  if (!cfg || !cfg.url || !cfg.secret) {
    throw new Error('Replit غير مُعدّ — شغّل أولاً: node re-work/ditto_api.js setup-push <url> <secret>');
  }

  const body = new URLSearchParams({
    ticket,
    secret:   cfg.secret,
    uid:      session.uid      || '',
    deviceId: session.deviceId || '',
  }).toString();

  return new Promise((resolve, reject) => {
    const urlObj  = new URL(cfg.url);
    const isHttps = urlObj.protocol === 'https:';
    const mod     = isHttps ? require('https') : require('http');

    const req = mod.request({
      hostname: urlObj.hostname,
      port:     urlObj.port || (isHttps ? 443 : 80),
      path:     urlObj.pathname,
      method:   'POST',
      headers: {
        'content-type':      'application/x-www-form-urlencoded',
        'content-length':    Buffer.byteLength(body).toString(),
        'x-webhook-secret':  cfg.secret,
      },
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode === 200) {
          console.log('☁️  Replit updated:', text.slice(0, 120));
          resolve(true);
        } else {
          console.error('❌ Replit push failed HTTP', res.statusCode, text.slice(0, 120));
          resolve(false);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Daemon mode
// ─────────────────────────────────────────────────────────────────────────────
async function daemonMode(withPush = false) {
  const label = withPush ? 'Daemon-Push' : 'Daemon';
  console.log(`🤖 ${label} — يجدد ticket كل 55 دقيقة${withPush ? ' ويبعته لـ Replit تلقائياً' : ''}`);
  console.log('   اضغط Ctrl+C للإيقاف\n');

  async function tick() {
    const session = loadSession();
    if (!session.access_token) {
      console.error('❌ No session. Run: node re-work/ditto_api.js login <access_token> <uid>');
      process.exit(1);
    }
    try {
      const ticket = await refreshTicket(session);
      if (withPush) {
        try { await pushToReplit(ticket, loadSession()); }
        catch (pe) { console.error('⚠️  Push error:', pe.message); }
      }
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
// ✅ = يعمل من Replit (مختبر live بالـ batch test يونيو 24 2026)
// ⚡ = يعمل من NOX/Android فقط (10003 من Replit — CDN geo-routing بـ IP الأمريكي)
const ENDPOINTS = {
  // ── يعمل من Replit ✅ (14 endpoint مؤكدة) ──────────────────────────────
  '/purse/query':                    { method: 'GET',  desc: '✅ رصيد المحفظة (goldNum, diamondNum, coin)' },
  '/home/tab/room':                  { method: 'GET',  desc: '✅ غرف البث | tab=POPULAR/SA/EG/AE pageNum pageSize' },
  '/explore/info':                   { method: 'GET',  desc: '✅ صفحة الاستكشاف | pageNo=1 pageSize=20' },
  '/gift/bar/actInlet':              { method: 'GET',  desc: '✅ أنشطة المحل' },
  '/silvercoin/getMissionInfo':      { method: 'GET',  desc: '✅ مهام العملات الفضية | type=1' },
  '/blind/box/list':                 { method: 'GET',  desc: '✅ الصناديق العمياء' },
  '/room/effects/get':               { method: 'GET',  desc: '✅ إعدادات التأثيرات' },
  '/emoji/emojiData':                { method: 'GET',  desc: '✅ بيانات الإيموجي | pageSize=50' },
  '/emoji/emojiType':                { method: 'GET',  desc: '✅ أنواع الإيموجي | showPosition=1' },
  '/modularization/game/list':       { method: 'GET',  desc: '✅ قائمة الألعاب | language=en os=android' },
  '/version/getInfo':                { method: 'GET',  desc: '✅ معلومات الإصدار (بدون ticket)' },
  '/client/country':                 { method: 'GET',  desc: '✅ قائمة الدول' },
  '/room/lucky/bag/getConf':         { method: 'GET',  desc: '✅ إعدادات الحقيبة المحظوظة' },
  '/home/get/continents':            { method: 'GET',  desc: '✅ قائمة القارات مع بلدانها' },
  '/giftwall/getUserHistoryReceives':{ method: 'GET',  desc: '✅ هدايا مستخدم المستلمة | tgUid=...' },

  // ── يعمل من NOX/Android فقط ⚡ (10003 من Replit) ──────────────────────
  '/user/v3/get':                    { method: 'GET',  desc: '⚡ بيانات مستخدم كاملة | queryUid=...' },
  '/home/v1/list':                   { method: 'GET',  desc: '⚡ قائمة البث المباشر' },
  '/home/v10/mine':                  { method: 'GET',  desc: '⚡ تاب Mine | pageNum=1 tagId=1 country=EG' },
  '/gift/listV3':                    { method: 'GET',  desc: '⚡ قائمة الهدايا | giftVersion=0' },
  '/gift/listPackage':               { method: 'GET',  desc: '⚡ باقات الهدايا' },
  '/activity/query':                 { method: 'GET',  desc: '⚡ الأنشطة | type=1' },
  '/banned/checkBanned':             { method: 'GET',  desc: '⚡ هل المستخدم محظور؟' },
  '/room/getRecommendCard':          { method: 'GET',  desc: '⚡ بطاقة الغرفة الموصى بها' },
  '/room/pk/getIsInviteNewMsg':      { method: 'GET',  desc: '⚡ رسائل دعوة PK' },
  '/room/pk/getInfo':                { method: 'GET',  desc: '⚡ معلومات PK | roomId=...' },
  '/room/mic/isMicUpApply':          { method: 'GET',  desc: '⚡ طلبات المايك | roomId=... type=1' },
  '/room/lucky/bag/get':             { method: 'GET',  desc: '⚡ جلب الحقيبة | roomId=...' },
  '/award/email/unread':             { method: 'GET',  desc: '⚡ الرسائل غير المقروءة' },
  '/user/whitelist/info':            { method: 'GET',  desc: '⚡ القائمة البيضاء' },
  '/client/pop/up/list':             { method: 'GET',  desc: '⚡ النوافذ المنبثقة' },
  '/client/configure':               { method: 'GET',  desc: '⚡ إعدادات التطبيق' },
  '/client/init':                    { method: 'GET',  desc: '⚡ تهيئة التطبيق | faceVersion=0 secondFaceVersion=0' },
  '/client/my/banner':               { method: 'GET',  desc: '⚡ بانرات الحساب' },
  '/activity/room/level/getInfo':    { method: 'GET',  desc: '⚡ مستوى غرفة | roomId=...' },
  '/live/get/last/data/record':      { method: 'GET',  desc: '⚡ آخر بيانات بث | roomUid=...' },
  '/room/getPowerRoom':              { method: 'GET',  desc: '⚡ الغرف الموصى بها' },
  '/fans/following':                 { method: 'GET',  desc: '⚡ المتابَعون | pageNo=1 pageSize=20' },
  '/fans/islike':                    { method: 'GET',  desc: '⚡ هل يتابعه؟ | isLikeUid=...' },
  '/fans/list':                      { method: 'GET',  desc: '⚡ المتابعون | pageNo=1 pageSize=20' },
  '/search/room':                    { method: 'GET',  desc: '⚡ بحث غرفة | key=...' },
  '/roomctrb/guardian/rank':         { method: 'GET',  desc: '⚡ ترتيب الحراس | guardianUid=... type=1' },
  '/user/prop/own':                  { method: 'GET',  desc: '⚡ ممتلكات مستخدم | tgUid=...' },
  '/sns/moment/list':                { method: 'POST', desc: '⚡ المنشورات | pageNo=1 type=0 pageSize=20' },
  '/match/cleanBusy':                { method: 'POST', desc: '⚡ إيقاف حالة المطابقة' },
  '/acc/online':                     { method: 'POST', desc: '⚡ تسجيل online' },
  '/user/update/current/language':   { method: 'POST', desc: '⚡ تحديث اللغة | updateLanguage=en' },
  '/sud/game/user/in':               { method: 'POST', desc: '⚡ دخول لعبة SUD' },
  '/uservisitor/visitorRecord':      { method: 'POST', desc: '⚡ سجل الزيارات | pageNum=1 pageSize=20' },
  '/giftCar/queryHistoryCarList':    { method: 'POST', desc: '⚡ تاريخ السيارات | tgUid=... pageNo=1 pageSize=20' },
  '/headwear/queryHistoryHeadwearList':{ method:'POST', desc: '⚡ تاريخ الأغطية | tgUid=... pageNo=1 pageSize=20' },
  '/sud/game/select/total/record':   { method: 'POST', desc: '⚡ إحصائيات لعبة | gameId=1001 targetUid=... type=0' },
  '/room/getTRtcToken':              { method: 'POST', desc: '⚡ توكن TRTC | roomId=... type=1 channel=0' },
  '/imsvr/v1/sendText':              { method: 'POST', desc: '⚡ إرسال رسالة | roomId=... type=1 content=...' },
  '/imsvr/v1/v3/fetchRoomMembers':   { method: 'POST', desc: '⚡ أعضاء الغرفة | roomId=... limit=50' },
  '/room/rocket/reEnter':            { method: 'POST', desc: '⚡ إعادة دخول صاروخ | roomUid=... roomType=3' },
  '/room/mic/lockmic':               { method: 'POST', desc: '⚡ قفل مايك | roomId=... position=... state=...' },
  '/silvercoin/receiveSilverCoin':   { method: 'POST', desc: '⚡ استلام عملات فضية | missionId=...' },
  '/oauth/ticket':                   { method: 'POST', desc: '⚡ تجديد ticket | access_token deviceId issue_type=multi' },
  '/acc/third/login':                { method: 'POST', desc: '⚡ تسجيل الدخول | thirdNick unionId type email turingToken' },
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
    console.log('  session                        عرض الـ session الحالية');
    console.log('  login <token> <uid> [deviceId] حفظ session جديد');
    console.log('  setup-push <url> <secret>      ربط Replit — يُحفظ في session مرة واحدة');
    console.log('  refresh                        تجديد ticket الآن (محلي فقط)');
    console.log('  refresh-push                   تجديد ticket + بعته لـ Replit فوراً');
    console.log('  daemon                         تجديد ticket كل 55 دقيقة (محلي)');
    console.log('  daemon-push                    تجديد + بعت لـ Replit كل 55 دقيقة ✅ الأفضل');
    console.log('  call <endpoint> [k=v ...]      استدعاء API');
    console.log('  decrypt "<base64>"             فك تشفير');
    console.log('  encrypt "plain text"           تشفير\n');
    console.log('Endpoints (✅ = يعمل من Replit | ⚡ = يعمل من NOX فقط):');
    Object.entries(ENDPOINTS).forEach(([ep, info]) => {
      console.log('  ' + ep.padEnd(40) + info.desc);
    });
    return;
  }

  if (cmd === 'session') {
    const s = loadSession();
    if (!s.uid) { console.log('❌ No session. Run: node re-work/ditto_api.js login <token> <uid>'); return; }
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
    const access_token = args[1];
    const uid          = args[2];
    const deviceId     = args[3] || crypto.randomBytes(16).toString('hex');

    if (!access_token || !uid) {
      console.log('الاستخدام: node re-work/ditto_api.js login <access_token> <uid> [deviceId]');
      return;
    }

    const session = { access_token, uid, deviceId, access_token_saved_at: Date.now() };
    saveSession(session);
    console.log('✅ Session saved. جاري جلب ticket...');

    try {
      await refreshTicket(session);
      printSession(loadSession());
      console.log('\n✅ جاهز! استخدم: node re-work/ditto_api.js call <endpoint>');
    } catch (e) {
      console.error('❌', e.message);
      console.log('💡 يمكنك إضافة ticket يدوياً من Frida أو NOX');
    }
    return;
  }

  if (cmd === 'setup-push') {
    const url    = args[1];
    const secret = args[2];
    if (!url || !secret) {
      console.log('الاستخدام: node re-work/ditto_api.js setup-push <replit_url> <webhook_secret>');
      console.log('مثال:');
      console.log('  node re-work/ditto_api.js setup-push https://abc.replit.dev/api/session/update MY_SECRET');
      return;
    }
    const session = loadSession();
    session._replit = { url, secret };
    saveSession(session);
    console.log('✅ Replit push مُعدّ — جرّب: node re-work/ditto_api.js refresh-push');
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

  if (cmd === 'refresh-push') {
    const session = loadSession();
    if (!session.access_token) { console.error('❌ No session'); return; }
    try {
      const ticket = await refreshTicket(session);
      await pushToReplit(ticket, loadSession());
      printSession(loadSession());
    } catch (e) {
      console.error('❌', e.message);
    }
    return;
  }

  if (cmd === 'daemon') {
    await daemonMode(false);
    return;
  }

  if (cmd === 'daemon-push') {
    await daemonMode(true);
    return;
  }

  if (cmd === 'call') {
    const session = loadSession();
    if (!session.access_token) {
      console.error('❌ No session. Run: node re-work/ditto_api.js login <access_token> <uid>');
      return;
    }

    const endpoint = args[1];
    if (!endpoint) { console.error('❌ Provide an endpoint'); return; }

    try {
      await ensureTicket(session);
    } catch (e) {
      console.warn('⚠️  Ticket refresh failed:', e.message);
      console.warn('   Using existing ticket (may be expired)');
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

    if (info && info.desc.startsWith('⚡')) {
      console.log('⚠️  هذا الـ endpoint يعمل من NOX/Android فقط — قد يرجع 10003 من Replit');
    }

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
