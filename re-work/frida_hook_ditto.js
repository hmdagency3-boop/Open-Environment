/**
 * Frida hook for com.ditto.mobile
 * Goal: Capture AES key + IV used for HTTP API encryption/decryption
 *
 * Run with:
 *   frida -U -f com.ditto.mobile -l frida_hook_ditto.js --no-pause
 * OR if already running:
 *   frida -U com.ditto.mobile -l frida_hook_ditto.js
 */

'use strict';

// ─── Utility ──────────────────────────────────────────────────────────────────
function hexdump16(buf) {
  if (!buf) return 'null';
  const arr = [];
  for (let i = 0; i < buf.length && i < 64; i++) {
    arr.push(('0' + buf[i].toString(16)).slice(-2));
  }
  return arr.join('');
}

function jstrToHex(javaStr) {
  if (!javaStr) return 'null';
  const s = javaStr.toString();
  const arr = [];
  for (let i = 0; i < s.length; i++) arr.push(('0' + s.charCodeAt(i).toString(16)).slice(-2));
  return s + '  |hex: ' + arr.join('');
}

// ─── Phase 1: Hook Java layer (JniUtils / JniAesKit) ─────────────────────────
Java.perform(function () {
  console.log('\n[*] Frida attached to com.ditto.mobile');
  console.log('[*] Hooking JNI key getter functions...\n');

  // Try all possible class names we found in DEX
  const classNames = [
    'com.juxiao.jni.JniUtils',
    'com.ditto.ditto_framework.aes.JniAesKit',
    'com.ditto.ditto_framework.des.DESKit',
    'com.ditto.ditto_framework.sign.SignKit',
  ];

  const methodNames = [
    'getAk', 'getAkIv', 'getDk', 'getEk',
    'getNetEaseKey', 'getAgoraKey',
    'getTmpSecretKey', 'getQnSecretKey',
    'encrypt', 'decrypt',
    'encryptAES', 'decryptAES',
  ];

  classNames.forEach(className => {
    try {
      const Cls = Java.use(className);
      console.log('[+] Found class: ' + className);

      methodNames.forEach(method => {
        try {
          if (Cls[method]) {
            Cls[method].overloads.forEach(overload => {
              overload.implementation = function () {
                const args = Array.from(arguments).map(a => {
                  if (a === null) return 'null';
                  return jstrToHex(a);
                });
                const result = overload.apply(this, arguments);
                console.log('\n[KEY] ' + className + '.' + method + '()');
                if (args.length > 0) console.log('  args: ' + args.join(', '));
                console.log('  => ' + jstrToHex(result));
                return result;
              };
            });
            console.log('  [hook] ' + method);
          }
        } catch (e) {}
      });
    } catch (e) {
      // Class not found, skip
    }
  });

  // ─── Hook AES operations directly (javax.crypto.Cipher) ─────────────────
  console.log('\n[*] Hooking javax.crypto.Cipher...');
  try {
    const Cipher = Java.use('javax.crypto.Cipher');

    Cipher.init.overload('int', 'java.security.Key').implementation = function (mode, key) {
      const encoded = key.getEncoded();
      const keyHex = hexdump16(encoded);
      console.log('\n[CIPHER] Cipher.init(mode=' + mode + ')');
      console.log('  key (' + encoded.length + ' bytes): ' + keyHex);
      const alg = this.getAlgorithm ? this.getAlgorithm() : '?';
      console.log('  algorithm: ' + alg);
      return this.init(mode, key);
    };

    Cipher.init.overload('int', 'java.security.Key', 'java.security.spec.AlgorithmParameterSpec').implementation = function (mode, key, spec) {
      const encoded = key.getEncoded();
      const keyHex = hexdump16(encoded);
      console.log('\n[CIPHER] Cipher.init(mode=' + mode + ', with IV spec)');
      console.log('  key (' + encoded.length + ' bytes): ' + keyHex);

      // Extract IV from IvParameterSpec
      try {
        const IvSpec = Java.use('javax.crypto.spec.IvParameterSpec');
        if (Java.cast(spec, IvSpec)) {
          const iv = Java.cast(spec, IvSpec).getIV();
          console.log('  IV  (' + iv.length + ' bytes): ' + hexdump16(iv));
        }
      } catch (e) {}

      const alg = this.getAlgorithm ? this.getAlgorithm() : '?';
      console.log('  algorithm: ' + alg);
      return this.init(mode, key, spec);
    };

    // Hook doFinal to see plaintext/ciphertext
    Cipher.doFinal.overload('[B').implementation = function (input) {
      const mode = this.getOpmode ? this.getOpmode() : '?';
      const label = (mode === 1) ? 'ENCRYPT' : 'DECRYPT';
      console.log('\n[CIPHER] doFinal (' + label + ')');
      console.log('  input  (' + input.length + ' bytes): ' + hexdump16(input) + '...');
      const result = this.doFinal(input);
      console.log('  output (' + result.length + ' bytes): ' + hexdump16(result) + '...');

      // If decrypting, try to show as UTF-8
      if (mode !== 1) {
        try {
          const str = Java.use('java.lang.String').$new(result, 'UTF-8');
          console.log('  output (utf8): ' + str.toString().slice(0, 200));
        } catch (e) {}
      }
      return result;
    };

    console.log('[+] Cipher hooks installed');
  } catch (e) {
    console.log('[-] Cipher hook failed: ' + e);
  }

  // ─── Hook SecretKeySpec to catch key construction ─────────────────────────
  try {
    const SecretKeySpec = Java.use('javax.crypto.spec.SecretKeySpec');
    SecretKeySpec.$init.overload('[B', 'java.lang.String').implementation = function (keyBytes, algorithm) {
      console.log('\n[KEY_SPEC] SecretKeySpec(' + algorithm + ')');
      console.log('  key (' + keyBytes.length + ' bytes): ' + hexdump16(keyBytes));
      return this.$init(keyBytes, algorithm);
    };
    console.log('[+] SecretKeySpec hook installed');
  } catch (e) {}

  // ─── Hook HTTP requests to see ed field being sent ────────────────────────
  console.log('\n[*] Hooking OkHttp for ed field monitoring...');
  try {
    const OkHttpClient = Java.use('okhttp3.OkHttpClient');
    const RequestBody = Java.use('okhttp3.RequestBody');

    // Hook okhttp3.FormBody
    const FormBody = Java.use('okhttp3.FormBody');
    FormBody.encodedValue.implementation = function (index) {
      const result = this.encodedValue(index);
      const name = this.encodedName(index);
      if (name.toString() === 'ed') {
        console.log('\n[HTTP] Request ed field value:');
        console.log('  ' + result.toString().slice(0, 200));
      }
      return result;
    };
    console.log('[+] OkHttp FormBody hook installed');
  } catch (e) {
    console.log('[-] OkHttp hook failed: ' + e);
  }

  console.log('\n[*] All hooks ready! Launch/use the app now.\n');
  console.log('='.repeat(60));
});

// ─── Phase 2: Native hook on libndklib-common.so functions ───────────────────
// Wait for the library to be loaded
setTimeout(function () {
  try {
    const module = Process.findModuleByName('libndklib-common.so');
    if (!module) {
      console.log('[-] libndklib-common.so not loaded yet. Try using the app first.');
      return;
    }

    console.log('\n[*] libndklib-common.so found at: ' + module.base);
    console.log('[*] Installing native hooks...');

    // Known function offsets from our analysis
    const nativeFunctions = [
      { name: 'getDk',  offset: 0x0a4c },
      { name: 'getEk',  offset: 0x2988 },
      { name: 'getAk',  offset: 0x2a14 },
      { name: 'getAkIv',offset: 0x2cec },
    ];

    nativeFunctions.forEach(fn => {
      try {
        const addr = module.base.add(fn.offset);
        Interceptor.attach(addr, {
          onLeave: function (retval) {
            // Return value is a pointer to a Java string or char*
            try {
              const str = retval.readUtf8String();
              console.log('\n[NATIVE] ' + fn.name + '() => "' + str + '"');
              console.log('  hex: ' + Buffer.from(str, 'utf8').toString('hex'));
            } catch (e) {
              console.log('\n[NATIVE] ' + fn.name + '() => ptr=' + retval + ' (read failed: ' + e + ')');
            }
          }
        });
        console.log('[+] Hooked native: ' + fn.name + ' @ ' + module.base.add(fn.offset));
      } catch (e) {
        console.log('[-] Failed to hook ' + fn.name + ': ' + e);
      }
    });

  } catch (e) {
    console.log('[-] Native hook error: ' + e);
  }
}, 3000);
