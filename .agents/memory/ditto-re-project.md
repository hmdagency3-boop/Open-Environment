---
name: Ditto Live APK Reverse Engineering — COMPLETE
description: Full RE of com.ditto.mobile. AES key/IV confirmed via Frida. Working external API client built. Session captured. All findings documented.
---

# Ditto Live (com.ditto.mobile) — Full RE Summary

## ✅ STATUS: SOLVED & WORKING

External API client built and confirmed working against `www.sayyouditto.com` — calls the server exactly like the real app, decrypts all responses.

---

## 🔑 Encryption Keys (CONFIRMED — PERMANENT)

| Field | Value |
|-------|-------|
| Algorithm | AES/CBC/PKCS5Padding (AES-128-CBC) |
| Key | `a38e5f04f39b11ed` — used as **16 ASCII bytes** (NOT hex-decoded) |
| IV  | `884e00163e02b26e` — used as **16 ASCII bytes** (NOT hex-decoded) |
| Key (hex) | `61333865356630346633396231316564` |
| IV  (hex) | `38383465303031363365303262323665` |

**These keys are hardcoded in the .so file. They only change if a new APK is released.**

### Why static analysis failed initially:
The .so `.data` section entries 13 and 16 had 2-byte obfuscation prefixes:
- Entry 13: `"2Aa38e5f04f39b11ed"` → `getAk()` skips first 2 bytes → `a38e5f04f39b11ed`
- Entry 16: `"q4884e00163e02b26e"` → `getAkIv()` skips first 2 bytes → `884e00163e02b26e`

### Frida confirmation output (verbatim):
```
[KEY] com.juxiao.jni.JniUtils.getAk()   => a38e5f04f39b11ed
[KEY] com.juxiao.jni.JniUtils.getAkIv() => 884e00163e02b26e
[KEY_SPEC] SecretKeySpec(AES) key (16 bytes): 61333865356630346633396231316564
[CIPHER] Cipher.init(mode=1, with IV spec) algorithm: AES/CBC/PKCS5Padding
```

### Decryption verified (live response):
```
{"code":200,"data":{"issue_type":"multi","tickets":[{"ticket":"8fdbe3534e4ba316718a38a220f71ade","expires_in":"3599"}]},"message":"نجاح"}
```

---

## 🌐 API Structure

**Host:** `https://www.sayyouditto.com`

**Request format:**
- Encrypt params as: `AES-CBC(plaintext)` → base64 → URL-encode
- GET:  `/endpoint?ed=<urlencoded_base64>`
- POST: body = `ed=<urlencoded_base64>`, Content-Type: `application/x-www-form-urlencoded`

**Response format:**
- Always: `{"ed":"<base64>"}` → decrypt → JSON
- Error responses (no encryption): `{"code":N,"message":"..."}` or `{"status":404,...}`

**Required HTTP headers:**
```
user-agent:     okhttp/4.9.0
simulator:      physical
language:       1
appcode:        1030400
appversion:     1.3.4.0
os:             android
app:            ditto
channel:        google_play
systemlanguage: en
osversion:      13
model:          Samsung SM-G988N
t:              <unix_timestamp_ms>
sn:             <7-char random hex>
accept-encoding: gzip
```

**Important:** Responses are gzip-compressed. Must gunzip before JSON parse.

---

## 👤 Current Session (captured June 24, 2026)

| Field | Value |
|-------|-------|
| uid | `1283476` |
| ticket | `8fdbe3534e4ba316718a38a220f71ade` (expires after 1hr) |
| access_token | `892d860f4efff40a0fe4f653553bd75c` |
| deviceId | `253e75fb2b6fc302dadc4b3ee96bc097` |
| simCountry | `eg` |

Session file: `re-work/ditto_session.json`

**Ticket lifecycle:** Expires every ~3600 seconds. Refresh via:
1. NOX + Frida (easiest — open app, ticket appears in output)
2. POST `/oauth/ticket` with `access_token` + `deviceId` + `issue_type=multi`

---

## 🔄 Authentication Flow (reverse engineered)

```
1. POST /acc/third/login
   params: { ... login credentials ... }
   → returns: { access_token: "..." }

2. POST /oauth/ticket
   params: { access_token, deviceId, issue_type: "multi", simCountry }
   → returns: { tickets: [{ ticket: "...", expires_in: "3599" }] }

3. All subsequent calls:
   params: { ticket, uid, deviceId, simCountry, ...endpoint_specific }
```

---

## 📋 Discovered Endpoints

### ✅ WORKING (no version restriction)
| Endpoint | Method | Notes |
|----------|--------|-------|
| `/purse/query` | GET | رصيد المحفظة: goldNum, diamondNum, coin |
| `/home/tab/room` | GET | غرف البث: tab=POPULAR/SA/EG/AE/... pageNum, pageSize |
| `/explore/info` | GET | Explore page: banners, gifts |
| `/oauth/ticket` | POST | تجديد الـ ticket |
| `/acc/third/login` | POST | تسجيل الدخول |
| `/gift/listV3` | GET | قائمة الهدايا |
| `/emoji/emojiData` | GET | بيانات الإيموجي |
| `/emoji/emojiType` | GET | أنواع الإيموجي |
| `/modularization/game/list` | GET | قائمة الألعاب |
| `/silvercoin/getMissionInfo` | GET | مهام العملات الفضية |
| `/activity/query` | GET | الأنشطة |

### ❌ VERSION-LOCKED (returns code 10003 "Please update app version")
These endpoints reject ALL appversions (even 2.0.0.0). Server-side enforcement unrelated to our appversion header.
| Endpoint | Notes |
|----------|-------|
| `/user/v3/get` | User profile — main profile endpoint. Param: `queryUid` |
| `/fans/list` | متابعون |
| `/fans/following` | متابَعون |
| `/fans/islike` | Param: `isLikeUid` |
| `/home/v10/mine` | Mine tab |
| `/room/getPowerRoom` | |
| `/room/getRecommendCard` | |
| `/room/pk/getInfo` | |
| `/live/get/last/data/record` | |
| `/roomctrb/guardian/rank` | Param: `guardianUid` |
| `/user/prop/own` | Param: `tgUid` |
| `/user/whitelist/info` | |
| `/client/configure` | |

### ❌ OTHER ERRORS
| Endpoint | Error | Notes |
|----------|-------|-------|
| `/sns/moment/list` | 405 Illegal client request | |
| `/uservisitor/visitorRecord` | 405 Illegal client request | |
| `/acc/online` | 405 Illegal client request | |
| `/giftwall/getUserHistoryReceives` | 400 Parameter exception | Needs correct params |

---

## 🔑 Other Keys Captured by Frida (bonus)

| Key | Algorithm | Source | Value |
|-----|-----------|--------|-------|
| getDk() | — | JniUtils | `3fb23ccf72a81881037835036c29f16d` |
| DES key 1 | DES | — | `4d494942496a414e` (hex) |
| DES key 2 | DES/ECB/PKCS5 | DNS | `7134526c596a4e71` (hex) → decrypts to DNS config: `log:1\|domain:0\|ip:119.29.29.90;119.28.28.90\|ttl:60\|time:0` |

---

## 🛠️ Working Tools

### `re-work/decrypt_ditto.js` — CLI decrypt/encrypt tool
```bash
node re-work/decrypt_ditto.js "<base64>"        # فك تشفير
node re-work/decrypt_ditto.js --encrypt "text"  # تشفير
```

### `re-work/ditto_api.js` — Full API client
```bash
node re-work/ditto_api.js help                      # مساعدة
node re-work/ditto_api.js session                   # عرض الـ session
node re-work/ditto_api.js call /purse/query         # استدعاء endpoint
node re-work/ditto_api.js call /home/tab/room tab=POPULAR pageNum=1 pageSize=20
node re-work/ditto_api.js decrypt "<base64>"        # فك تشفير
node re-work/ditto_api.js encrypt "plain text"      # تشفير
node re-work/ditto_api.js refresh                   # تجديد ticket
```

### `re-work/frida_hook_ditto.js` — Frida runtime hook
- Hooks: `getAk`, `getAkIv`, `getDk`, `getNetEaseKey`, `getAgoraKey`
- Hooks: `javax.crypto.Cipher` (init + doFinal — captures all encrypt/decrypt ops)
- Hooks: `SecretKeySpec` (captures all key specs)
- Prints plaintext of all encrypted requests and decrypted responses in real time

---

## 💻 Frida / NOX Setup

```
NOX ADB:        adb connect 127.0.0.1:62001
NOX adb path:   G:\nox\Nox\bin\adb.exe
frida-server:   frida-server-16.5.9-android-x86  (in /data/local/tmp/)
frida-tools:    12.5.0
frida Python:   16.5.9
```

**Start frida-server:**
```
adb shell "su -c '/data/local/tmp/frida-server &'"
```

**Attach hook (app must be open first):**
```
frida -U com.ditto.mobile -l re-work/frida_hook_ditto.js
```

**Why no `--no-pause`:** Flag removed in frida-tools 12.x. Use attach mode (no `-f` flag).

**Why `android-x86`:** NOX is an x86 emulator not ARM.

---

## 📁 Key Files

```
re-work/decrypt_ditto.js              ← فك تشفير / تشفير CLI
re-work/ditto_api.js                  ← API client كامل
re-work/ditto_session.json            ← session الحالي (ticket + uid + deviceId)
re-work/frida_hook_ditto.js           ← Frida hook script
re-work/libs/lib/armeabi-v7a/libndklib-common.so  ← الـ .so المصدر
attached_assets/flows_(1)_1782249615303  ← 176 flows mitmproxy capture
attached_assets/flows_1782235851805      ← 29 flows (original)
```

---

## 🔍 Real Param Names (from decrypted flows)

These are the EXACT parameter names the real app uses (critical — wrong names = wrong results):

| Endpoint | Correct Param | Wrong (don't use) |
|----------|--------------|-------------------|
| `/user/v3/get` | `queryUid` | toUid, targetUid, userId |
| `/user/prop/own` | `tgUid` | toUid, targetUid |
| `/fans/islike` | `isLikeUid` | toUid, targetUid |
| `/roomctrb/guardian/rank` | `guardianUid` | toUid |
| `/explore/info` | `pageNo` (not pageNum) | pageNum |
| `/home/v10/mine` | `tagId`, `country` required | — |
| `/room/lucky/bag/get` | `roomId` | — |
| All endpoints | `simCountry=eg` always | — |

---

## ⚠️ Current Limitation

The version-locked endpoints (`/user/v3/get` etc.) need a newer `appcode`. To fix:
1. Download latest Ditto APK from APKPure/APKMirror
2. Install on NOX
3. Run Frida hook — it will print the new `appcode` and `appversion` in the headers
4. Update `makeHeaders()` in `re-work/ditto_api.js`

**Note:** The AES Key/IV will NOT change between minor app updates (they're in the .so).
