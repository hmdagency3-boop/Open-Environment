/**
 * frida_ticket_pusher.js — Auto-push Ditto ticket to Replit on refresh
 *
 * كل ما التطبيق جدّد التيكيت، الـ script ده هيبعته تلقائياً لـ Replit.
 *
 * قبل التشغيل — عدّل القيمتين دول:
 *   REPLIT_HOST    : الـ domain بتاعت الـ Replit (من المتصفح)
 *   WEBHOOK_SECRET : من ملف .env أو من الـ Replit Secrets
 *
 * الاستخدام (NOX متشغّل والتطبيق مفتوح):
 *   adb connect 127.0.0.1:62001
 *   adb shell "su -c '/data/local/tmp/frida-server &'"
 *   frida -U com.ditto.mobile -l frida_ticket_pusher.js
 */

'use strict';

// ─── CONFIG (عدّل هنا فقط) ───────────────────────────────────────────────────
var REPLIT_HOST    = 'f12de453-ad04-4d80-a5a2-d681c2fb1700-00-156sgqnpzc4v6.picard.replit.dev';
var WEBHOOK_PATH   = '/api/session/update';
var WEBHOOK_SECRET = '9c95c0ea01ffdd3362d3b282ffb40cc54dea258b230f066a';
// ──────────────────────────────────────────────────────────────────────────────

if (REPLIT_HOST === 'YOUR_REPLIT_DEV_DOMAIN_HERE') {
  console.log('[⚠️] لازم تعبّي REPLIT_HOST و WEBHOOK_SECRET في أول السكريبت!');
}

var lastPushedTicket = null;
var lastCipherMode   = -1;   // 1=ENCRYPT, 2=DECRYPT — tracked from init
var lastUid          = null;
var lastDeviceId     = null;

// ─── MAIN ────────────────────────────────────────────────────────────────────
Java.perform(function () {
  console.log('[*] frida_ticket_pusher loaded — waiting for /oauth/ticket...\n');

  var Cipher = Java.use('javax.crypto.Cipher');

  // ── Track cipher mode via init (more reliable than getOpmode) ──────────────
  var initOverloads = [
    Cipher.init.overload('int', 'java.security.Key'),
    Cipher.init.overload('int', 'java.security.Key', 'java.security.spec.AlgorithmParameterSpec'),
    Cipher.init.overload('int', 'java.security.Key', 'java.security.AlgorithmParameters'),
  ];

  initOverloads.forEach(function (ov) {
    ov.implementation = function () {
      var mode = arguments[0];
      if (mode === 1 || mode === 2) lastCipherMode = mode;
      return ov.apply(this, arguments);
    };
  });

  // ── Hook doFinal — hold reference to original to avoid recursion ───────────
  var origDoFinal = Cipher.doFinal.overload('[B');
  origDoFinal.implementation = function (input) {
    // Call original first — no recursion because we use origDoFinal.call
    var result = origDoFinal.call(this, input);
    var mode   = lastCipherMode;

    // ── ENCRYPT: extract uid / deviceId from outgoing params ─────────────────
    if (mode === 1) {
      try {
        var plain = Java.use('java.lang.String').$new(input, 'UTF-8').toString();
        var uidM  = plain.match(/(?:^|&)uid=([^&]+)/);
        var devM  = plain.match(/(?:^|&)deviceId=([^&]+)/);
        if (uidM) lastUid      = uidM[1];
        if (devM) lastDeviceId = devM[1];
      } catch (e) { /* ignore */ }
    }

    // ── DECRYPT: gunzip → check for "tickets" JSON ───────────────────────────
    if (mode === 2) {
      try {
        var ByteArrayInputStream  = Java.use('java.io.ByteArrayInputStream');
        var GZIPInputStream       = Java.use('java.util.zip.GZIPInputStream');
        var ByteArrayOutputStream = Java.use('java.io.ByteArrayOutputStream');

        var bais = ByteArrayInputStream.$new(result);

        var gzis;
        try {
          gzis = GZIPInputStream.$new(bais);
        } catch (notGzip) {
          // Not gzipped — try plain UTF-8
          try {
            var s = Java.use('java.lang.String').$new(result, 'UTF-8').toString();
            if (s.indexOf('"tickets"') !== -1) extractAndPush(s);
          } catch (e2) { /* ignore */ }
          return result;
        }

        var baos = ByteArrayOutputStream.$new();
        var buf  = Java.array('byte', new Array(4096).fill(0));
        var len;
        while ((len = gzis.read(buf)) > 0) {
          baos.write(buf, 0, len);
        }
        gzis.close();

        var json = Java.use('java.lang.String').$new(baos.toByteArray(), 'UTF-8').toString();
        if (json.indexOf('"tickets"') !== -1) extractAndPush(json);

      } catch (e) { /* ignore non-ticket responses */ }
    }

    return result;
  };

  function extractAndPush(json) {
    // Match ticket — 32 hex chars
    var m = json.match(/"ticket"\s*:\s*"([0-9a-fA-F]{32})"/);
    if (!m) return;

    var ticket = m[1];
    if (ticket === lastPushedTicket) {
      console.log('[~] Same ticket — skipping push.');
      return;
    }

    lastPushedTicket = ticket;
    console.log('\n[🎫 TICKET] ' + ticket.slice(0, 16) + '... — pushing to Replit...');

    var uid      = lastUid;
    var deviceId = lastDeviceId;

    // ── Fire HTTP on a background thread via setTimeout → Java.perform ────────
    // setTimeout(0) yields back to Frida's event loop without blocking the app
    setTimeout(function () {
      Java.perform(function () {
        try {
          var body = 'ticket=' + ticket + '&secret=' + WEBHOOK_SECRET;
          if (uid)      body += '&uid='      + uid;
          if (deviceId) body += '&deviceId=' + deviceId;

          var bodyBytes = Java.use('java.lang.String').$new(body).getBytes('UTF-8');

          var URL          = Java.use('java.net.URL');
          var HttpsConn    = Java.use('javax.net.ssl.HttpsURLConnection');
          var url          = URL.$new('https://' + REPLIT_HOST + WEBHOOK_PATH);
          var conn         = Java.cast(url.openConnection(), HttpsConn);

          conn.setRequestMethod('POST');
          conn.setDoOutput(true);
          conn.setConnectTimeout(10000);
          conn.setReadTimeout(10000);
          conn.setRequestProperty('Content-Type', 'application/x-www-form-urlencoded');
          conn.setRequestProperty('Content-Length', '' + bodyBytes.length);
          conn.setRequestProperty('x-webhook-secret', WEBHOOK_SECRET);

          var os = conn.getOutputStream();
          os.write(bodyBytes);
          os.flush();
          os.close();

          var code = conn.getResponseCode();

          var StreamReader = Java.use('java.io.InputStreamReader');
          var BuffReader   = Java.use('java.io.BufferedReader');
          var inStream     = (code === 200) ? conn.getInputStream() : conn.getErrorStream();
          var reader       = BuffReader.$new(StreamReader.$new(inStream, 'UTF-8'));
          var sb           = Java.use('java.lang.StringBuilder').$new();
          var line;
          while ((line = reader.readLine()) !== null) {
            sb.append(line);
          }
          reader.close();
          conn.disconnect();

          if (code === 200) {
            console.log('[✅ PUSHED]  HTTP ' + code + ' — ' + sb.toString());
          } else {
            console.log('[❌ FAILED]  HTTP ' + code + ' — ' + sb.toString());
          }
        } catch (e) {
          console.log('[❌ HTTP ERR] ' + e);
        }
      });
    }, 0);
  }

  console.log('[*] Hook active. Open/use Ditto to trigger a ticket refresh.\n');
});
