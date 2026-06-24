---
name: Ditto Live APK Reverse Engineering
description: SOLVED - AES key/IV captured via Frida dynamic analysis
---

## ✅ SOLVED — Keys Confirmed

**Algorithm:** AES/CBC/PKCS5Padding (AES-128-CBC)  
**Key:** `a38e5f04f39b11ed`  (used as 16 ASCII bytes, NOT hex-decoded)  
**IV:**  `884e00163e02b26e`  (used as 16 ASCII bytes, NOT hex-decoded)

**Verified:**
- `C0 = 704bffa483e753c11b9a7d99d048106a` → decrypts to `{"code":200,"dat"` ✅
- Round-trip encrypt/decrypt confirmed ✅
- `re-work/decrypt_ditto.js` is the final working tool

**Why static analysis failed:** The decoded .data entries 13 and 16 had 2-byte prefixes:
- Entry 13: `"2Aa38e5f04f39b11ed"` → `getAk()` returns substring skipping first 2 bytes → `a38e5f04f39b11ed`
- Entry 16: `"q4884e00163e02b26e"` → `getAkIv()` returns substring skipping first 2 bytes → `884e00163e02b26e`
The keys were in the .so all along — we failed to strip the 2-byte prefix from entries 13/16.

## Usage

```bash
# Decrypt an ed field
node re-work/decrypt_ditto.js "<base64_value>"

# Encrypt plaintext
node re-work/decrypt_ditto.js --encrypt "plain text"

# Self-test / verify
node re-work/decrypt_ditto.js
```

## Frida Setup (for future re-capture if keys change)

- frida-server: `frida-server-16.5.9-android-x86` (for NOX emulator)
- frida Python: `16.5.9`
- frida-tools: `12.5.0`
- Hook script: `re-work/frida_hook_ditto.js`
- NOX ADB: `adb connect 127.0.0.1:62001`
- NOX adb.exe path: `G:\nox\Nox\bin\adb.exe`
- frida-server start: `adb shell "su -c '/data/local/tmp/frida-server &'"`
- Hook run (attach mode, app must be open first): `frida -U com.ditto.mobile -l frida_hook_ditto.js`

**Why:** `--no-pause` flag removed in frida-tools 12.x vs 14.x. Use attach mode (no -f flag).

## Key Files
```
re-work/decrypt_ditto.js              ← FINAL decryption tool (working)
re-work/frida_hook_ditto.js           ← Frida hook for runtime key capture
re-work/xapk_extracted/com.ditto.mobile.apk
re-work/libs/lib/armeabi-v7a/libndklib-common.so
attached_assets/flows_1782235851805   ← 29 flows (original capture)
attached_assets/flows_(1)_1782249615303 ← 176 flows (new capture)
```

## Server
- Host: `www.sayyouditto.com`
- All responses: `{"ed":"<base64>"}` — decrypt with above key/IV
- All requests: `ed=<url-encoded-base64>` — same key/IV
