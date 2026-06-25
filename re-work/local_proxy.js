/**
 * local_proxy.js — Ditto Local Tunnel Proxy
 * شغّله على جهازك في مصر، وReplit هيتوصل بيه عشان الـ requests تعدي من IP مصري
 *
 * الاستخدام على Windows:
 *   node local_proxy.js
 *   (هيطبعلك الـ SECRET اللي هتحتاجه على Replit)
 *
 * بعدين على Replit:
 *   node ditto_api.js setup-proxy <IP_بتاعك> 7474 <SECRET>
 *
 * الـ port الافتراضي: 7474 — ممكن تغيّره: node local_proxy.js 8888
 */

'use strict';

const http   = require('http');
const https  = require('https');
const net    = require('net');
const crypto = require('crypto');
const url    = require('url');

const PORT = parseInt(process.argv[2] || '7474', 10);

// توليد secret عشوائي في كل مرة تشغيل — الـ secret ده هتحتاجه على Replit
const SECRET = crypto.randomBytes(20).toString('hex');

const server = http.createServer((req, res) => {
  // Plain HTTP requests (not used for HTTPS target, but handled for completeness)
  if (req.headers['x-proxy-secret'] !== SECRET) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const parsed = url.parse(req.url);
  const useHttps = parsed.protocol === 'https:' || parseInt(parsed.port, 10) === 443;
  const proto = useHttps ? https : http;

  const options = {
    hostname: parsed.hostname,
    port:     parseInt(parsed.port || (useHttps ? '443' : '80'), 10),
    path:     parsed.path || '/',
    method:   req.method,
    headers:  Object.assign({}, req.headers),
  };
  delete options.headers['x-proxy-secret'];
  delete options.headers['host'];

  const proxyReq = proto.request(options, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', e => {
    console.error('[proxy] upstream error:', e.message);
    if (!res.headersSent) { res.writeHead(502); res.end('Bad Gateway'); }
  });
  req.pipe(proxyReq);
});

// HTTPS CONNECT tunnel — ده اللي بيستخدمه Replit
server.on('connect', (req, clientSocket, head) => {
  if (req.headers['x-proxy-secret'] !== SECRET) {
    clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    return clientSocket.destroy();
  }

  const [hostname, portStr] = req.url.split(':');
  const port = parseInt(portStr || '443', 10);

  const serverSocket = net.connect({ host: hostname, port }, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length > 0) serverSocket.write(head);
    serverSocket.pipe(clientSocket);
    clientSocket.pipe(serverSocket);
  });

  serverSocket.on('error', e => {
    console.error('[tunnel] error:', hostname, e.message);
    clientSocket.destroy();
  });
  clientSocket.on('error', () => serverSocket.destroy());
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║           Ditto Local Proxy — شغّال ✅               ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  Port  :', PORT);
  console.log('  Secret:', SECRET);
  console.log('');
  console.log('📋 خطوات الإعداد:');
  console.log('');
  console.log('  1️⃣  اعرف الـ IP العام بتاعك — افتح المتصفح وروح على:');
  console.log('       https://api.ipify.org');
  console.log('');
  console.log('  2️⃣  افتح port', PORT, 'في الـ Windows Firewall:');
  console.log('       (ابحث عن "Windows Defender Firewall" → Inbound Rules → New Rule → Port →', PORT, ')');
  console.log('');
  console.log('  3️⃣  على Replit نفّذ:');
  console.log('       node ditto_api.js setup-proxy <IP_بتاعك>', PORT, SECRET);
  console.log('');
  console.log('  4️⃣  جرّب:');
  console.log('       node ditto_api.js call /user/v3/get queryUid=281306');
  console.log('');
  console.log('⚠️  خلّي النافذة دي مفتوحة — لو أقفلتها الـ proxy وقف');
  console.log('');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} محجوز — جرّب port تاني: node local_proxy.js 8080`);
  } else {
    console.error('❌ Server error:', e.message);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Proxy وقف.');
  server.close(() => process.exit(0));
});
