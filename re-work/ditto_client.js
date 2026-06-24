/**
 * Ditto Live API Client — Auto-Session Manager
 * تلقائيًا يجدد الـ ticket ويعيد المحاولة لو انتهت الصلاحية
 */
const crypto = require('crypto');
const https  = require('https');
const zlib   = require('zlib');
const fs     = require('fs');
const path   = require('path');

const SESSION_FILE = path.join(__dirname, 'ditto_session.json');

// ─── AES Crypto ────────────────────────────────────────────────────────────
const AES_KEY = Buffer.from('a38e5f04f39b11ed');
const AES_IV  = Buffer.from('884e00163e02b26e');

function encrypt(text) {
  const c = crypto.createCipheriv('aes-128-cbc', AES_KEY, AES_IV);
  return Buffer.concat([c.update(Buffer.from(text)), c.final()]).toString('base64');
}
function decrypt(b64) {
  const d = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
  return Buffer.concat([d.update(Buffer.from(b64, 'base64')), d.final()]).toString('utf8');
}

// ─── Base Headers (exact copy from working flows) ──────────────────────────
function makeHeaders(extra = {}) {
  return {
    'user-agent':     'okhttp/4.12.0',     // from working flow
    'simulator':      'physical',
    'language':       '1',
    'appcode':        '1030400',
    'appversion':     '1.3.4.0',
    'os':             'android',
    'app':            'ditto',
    'channel':        'google_play',
    'systemlanguage': 'en',
    'osversion':      '13',
    'model':          'M1908C3JGG',        // from working flow
    't':              Date.now().toString(),
    'sn':             crypto.randomBytes(3).toString('hex') + '0',
    'accept-encoding':'gzip',
    ...extra
  };
}

// ─── Raw HTTP request ───────────────────────────────────────────────────────
function rawRequest(method, urlPath, encParams) {
  return new Promise((resolve, reject) => {
    const ed = encodeURIComponent(encrypt(encParams));
    const headers = makeHeaders();
    let postBody = null;

    if (method === 'POST') {
      postBody = 'ed=' + encodeURIComponent(encrypt(encParams));
      headers['content-type']   = 'application/x-www-form-urlencoded';
      headers['content-length'] = Buffer.byteLength(postBody);
    }

    const req = https.request({
      hostname: 'www.sayyouditto.com',
      path: method === 'GET' ? urlPath + '?ed=' + ed : urlPath,
      method, headers
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let body;
        try { body = zlib.gunzipSync(raw).toString('utf8'); }
        catch (e) { body = raw.toString('utf8'); }
        try {
          const json = JSON.parse(body);
          if (json.ed) resolve(JSON.parse(decrypt(json.ed)));
          else resolve(json);
        } catch (e) { reject(new Error(body.substring(0, 300))); }
      });
    });
    req.on('error', reject);
    if (postBody) req.write(postBody);
    req.end();
  });
}

// ─── Session Manager ────────────────────────────────────────────────────────
class DittoSession {
  constructor() {
    this.session = null;
    this.ticketExpiry = 0;
  }

  load() {
    if (fs.existsSync(SESSION_FILE)) {
      this.session = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      // ticketExpiry not persisted, assume expired on load
      this.ticketExpiry = 0;
    }
  }

  save() {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(this.session, null, 2));
  }

  /** Update session from fresh Frida/NOX capture */
  update({ uid, access_token, ticket, deviceId, ticketExpiry }) {
    this.session = { uid, access_token, ticket, deviceId };
    this.ticketExpiry = ticketExpiry || (Date.now() / 1000 + 3599);
    this.save();
    console.log('✅ Session updated for uid:', uid);
  }

  isTicketValid() {
    return this.session?.ticket && (Date.now() / 1000) < (this.ticketExpiry - 60);
  }

  /** Refresh ticket using access_token */
  async refreshTicket() {
    if (!this.session?.access_token) throw new Error('No access_token — need fresh login from NOX');
    const { uid, access_token, deviceId } = this.session;
    console.log('🔄 Refreshing ticket...');
    const res = await rawRequest('POST', '/oauth/ticket',
      `access_token=${access_token}&deviceId=${deviceId}&issue_type=multi&simCountry=eg`
    );
    if (res.code !== 200) throw new Error(`Ticket refresh failed: ${JSON.stringify(res)}`);
    this.session.ticket = res.data.tickets[0].ticket;
    this.ticketExpiry = Date.now() / 1000 + parseInt(res.data.tickets[0].expires_in);
    this.save();
    console.log('✅ New ticket:', this.session.ticket, '| expires in:', res.data.tickets[0].expires_in, 's');
    return this.session.ticket;
  }

  /** Get base params string (auto-refresh ticket if needed) */
  async baseParams() {
    if (!this.isTicketValid()) {
      await this.refreshTicket();
    }
    const { uid, ticket, deviceId } = this.session;
    return `uid=${uid}&ticket=${ticket}&deviceId=${deviceId}&simCountry=eg`;
  }
}

// ─── API Methods ────────────────────────────────────────────────────────────
class DittoAPI {
  constructor(session) {
    this.session = session;
  }

  /** GET user full profile by UID */
  async getUserProfile(queryUid, type = '') {
    const base = await this.session.baseParams();
    const typeParam = type ? `&type=${type}` : '';
    return rawRequest('GET', '/user/v3/get', `queryUid=${queryUid}&${base}${typeParam}`);
  }

  /** GET user's moments/posts */
  async getUserMoments(queryUid, page = 1) {
    const base = await this.session.baseParams();
    return rawRequest('POST', '/sns/moment/list',
      `pageNo=${page}&pageSize=20&queryUid=${queryUid}&${base}`);
  }

  /** GET fans list */
  async getFans(queryUid, page = 1) {
    const base = await this.session.baseParams();
    return rawRequest('GET', '/fans/list', `pageNo=${page}&pageSize=20&queryUid=${queryUid}&${base}`);
  }

  /** GET following list */
  async getFollowing(queryUid, page = 1) {
    const base = await this.session.baseParams();
    return rawRequest('GET', '/fans/following', `pageNo=${page}&pageSize=20&queryUid=${queryUid}&${base}`);
  }

  /** GET user home/mine info */
  async getUserMine(queryUid) {
    const base = await this.session.baseParams();
    return rawRequest('GET', '/home/v10/mine', `queryUid=${queryUid}&${base}`);
  }

  /** Search user (by erbanNo or name) */
  async searchUser(keyword) {
    const base = await this.session.baseParams();
    return rawRequest('GET', '/user/search', `keyword=${encodeURIComponent(keyword)}&${base}`);
  }

  /** Generic call */
  async call(method, path, extraParams = '') {
    const base = await this.session.baseParams();
    return rawRequest(method, path, `${extraParams}&${base}`);
  }
}

// ─── Export ─────────────────────────────────────────────────────────────────
module.exports = { DittoSession, DittoAPI, rawRequest, encrypt, decrypt };

// ─── CLI Mode ───────────────────────────────────────────────────────────────
if (require.main === module) {
  const session = new DittoSession();
  session.load();

  const args = process.argv.slice(2);
  const cmd  = args[0];

  if (cmd === 'update-session') {
    // node ditto_client.js update-session <uid> <access_token> <ticket> <deviceId>
    const [, uid, access_token, ticket, deviceId] = args;
    session.update({ uid, access_token, ticket, deviceId,
      ticketExpiry: Date.now()/1000 + 3599 });

  } else if (cmd === 'user') {
    // node ditto_client.js user <uid>
    const api = new DittoAPI(session);
    api.getUserProfile(args[1]).then(r => {
      console.log(JSON.stringify(r, null, 2));
    }).catch(e => console.error('Error:', e.message));

  } else if (cmd === 'refresh') {
    session.refreshTicket().catch(e => console.error('Error:', e.message));

  } else {
    console.log(`
Ditto API Client — Commands:
  node ditto_client.js update-session <uid> <access_token> <ticket> <deviceId>
  node ditto_client.js refresh        → refresh ticket using stored access_token
  node ditto_client.js user <uid>     → get full user profile
    `);
  }
}
