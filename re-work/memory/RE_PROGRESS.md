# Ditto Live APK — Reverse Engineering Progress
**آخر تحديث:** 2026-06-24  
**الهدف:** استخراج مفاتيح AES من libndklib-common.so، بناء API client خارجي يستدعي www.sayyouditto.com كأنه التطبيق الحقيقي.

---

## ✅ الحالة الحالية: شغّال

- المفاتيح استُخرجت ✅
- API client كامل في `re-work/ditto_api.js` ✅
- 14 endpoint تعمل من Replit ✅
- 57 endpoint موثقة من الـ flows ✅
- سبب الـ 10003 معروف (CDN geo-lock) ✅

---

## 1. معلومات التطبيق

| البيان | القيمة |
|--------|--------|
| اسم التطبيق | Ditto Live - Match & Meet Someone |
| Package Name | `com.ditto.mobile` |
| الإصدار | 1.3.4.0 |
| appcode | `1030400` |
| مصدر الملف | APKPure XAPK |

---

## 2. مصدر الملف (GitHub LFS)

```
Repository:  https://github.com/hmdagency3-boop/-.git
Branch:      main
File:        Ditto+Live+-Match&meet+someone_1.3.4.0_APKPure.xapk
LFS OID:     sha256:ab63c5ef912ca03ca97362ddfed0f0deb0129c94efc25ab26cbcc12a0fdf7645
LFS Size:    153,966,669 bytes (147MB)
```

### طريقة التحميل (تعمل 100%):
```bash
mkdir -p /home/runner/workspace/re-work
git clone --depth=1 https://github.com/hmdagency3-boop/-.git /home/runner/workspace/re-work/repo
```

### استخراج الـ XAPK:
```bash
cd /home/runner/workspace/re-work
mkdir -p xapk_extracted
unzip -o "repo/Ditto+Live+-Match&meet+someone_1.3.4.0_APKPure.xapk" -d xapk_extracted/
# ينتج:
#   com.ditto.mobile.apk     (80MB) — الـ APK الرئيسي (لا يحتوي .so)
#   config.armeabi_v7a.apk  (66MB) — يحتوي على كل ملفات .so ⬅️ المهم
mkdir -p libs
unzip -o "xapk_extracted/config.armeabi_v7a.apk" "lib/armeabi-v7a/libndklib-common.so" -d libs/
```

---

## 3. المفاتيح المستخرجة (مؤكدة بـ Frida)

| المفتاح | القيمة | الاستخدام |
|---------|--------|-----------|
| AES Key | `a38e5f04f39b11ed` | ASCII bytes مباشرة (مش hex-decode) |
| AES IV  | `884e00163e02b26e` | ASCII bytes مباشرة |
| الخوارزمية | AES/CBC/PKCS5Padding | 128-bit |
| getDk() | `3fb23ccf72a81881037835036c29f16d` | Decrypt Key (غرض آخر) |

### الـ obfuscation:
كل entry في `.data` section عندها 2-byte prefix مزيف:
- `"2A" + "a38e5f04f39b11ed"` → `getAk()` بتعمل skip لأول 2 bytes
- `"q4" + "884e00163e02b26e"` → `getAkIv()` نفس الشيء

---

## 4. هيكل الـ API

### التشفير:
```javascript
const KEY = Buffer.from('a38e5f04f39b11ed', 'ascii'); // 16 bytes
const IV  = Buffer.from('884e00163e02b26e', 'ascii'); // 16 bytes

function encrypt(plain) {
  const e = crypto.createCipheriv('aes-128-cbc', KEY, IV);
  return Buffer.concat([e.update(Buffer.from(plain,'utf8')), e.final()]).toString('base64');
}

function decrypt(b64) {
  // normalize base64, then:
  const d = crypto.createDecipheriv('aes-128-cbc', KEY, IV);
  const p = Buffer.concat([d.update(Buffer.from(b64,'base64')), d.final()]);
  return zlib.gunzipSync(p).toString('utf8'); // gzipped!
}
```

### الطلبات:
```
GET  /endpoint?ed=<urlencoded(base64(AES(params_string)))>
POST /endpoint  body: ed=<urlencoded(base64(AES(params_string)))>
     Content-Type: application/x-www-form-urlencoded
```

### الردود:
```
{"ed":"<base64>"} → AES decrypt → gunzip → JSON
أو مباشرة: {"code":N,"message":"..."} للأخطاء
```

### الـ headers (مؤكدة من flows byte-by-byte):
```
simulator: physical          language: 1
appcode: 1030400             appversion: 1.3.4.0
os: android                  app: ditto
model: M1908C3JGG            channel: google_play
systemlanguage: en           osversion: 13
t: <timestamp_ms>            sn: <7char_hex>
accept-encoding: gzip        user-agent: okhttp/4.12.0
```

---

## 5. الـ Flows المحفوظة

| الملف | عدد الـ flows | UID | التاريخ |
|-------|--------------|-----|---------|
| `attached_assets/flows_(1)_1782249615303` | 176 | mixed | 23 يونيو 2026 |
| `attached_assets/flows_(2)_1782315155151` | 79 | 1283476 | 24 يونيو 2026 |
| `attached_assets/flows_(3)_1782326333345` | 41 | 281306 | 24 يونيو 2026 |

**الـ format:** TNET binary. Parser Node.js متاح في `ditto_api.js`.

---

## 6. Authentication Flow

```
1. POST /acc/third/login
   params: { thirdNick, unionId, type, email, turingToken, deviceId, simCountry }
   → returns: { access_token, uid, netEaseToken, ... }

2. POST /oauth/ticket
   params: { access_token, deviceId, issue_type: "multi", simCountry }
   ⚠️ لا uid param!
   → returns: { tickets: [{ ticket: "...", expires_in: "3599" }] }

3. كل الطلبات بعدها:
   params: { ticket, uid, deviceId, simCountry: "eg", ...endpoint_specific }
```

---

## 7. Sessions الحالية

### uid=281306 (primary — في session file)
```json
{
  "uid": "281306",
  "ticket": "e3e7bc6d30eaa492746ba3c242253007",
  "access_token": "ed93ba1f476a042efd8b86ed851234bb",
  "deviceId": "27e0073c1e0d132a0b66a84ff8ada5baa",
  "ticket_saved_at": 1782326333345
}
```

### uid=1283476 (backup — من flows_(2))
```
access_token: 791aa515f219b46df5ec79ff2e2c813f
ticket: 8fdbe3534e4ba316718a38a220f71ade (منتهي)
deviceId: 253e75fb2b6fc302dadc4b3ee96bc097
```

---

## 8. الـ Endpoints المؤكدة من الـ Flows (57 endpoint بـ API 200)

### ✅ تعمل من Replit (14 — تم اختبارها live بالـ batch test):
```
GET  /purse/query
GET  /home/tab/room              [tab=POPULAR/SA/EG/AE, pageNum, pageSize]
GET  /explore/info               [pageNo=1, pageSize=20]
GET  /gift/bar/actInlet
GET  /silvercoin/getMissionInfo  [type=1]
GET  /blind/box/list
GET  /room/effects/get
GET  /emoji/emojiData            [pageSize=50]
GET  /emoji/emojiType            [showPosition=1]
GET  /modularization/game/list   [language=en, os=android]
GET  /version/getInfo
GET  /client/country
GET  /room/lucky/bag/getConf
GET  /home/get/continents
GET  /giftwall/getUserHistoryReceives  [tgUid=...]  ← works! (confirmed UID 1090748)
```

### ⚡ تعمل من NOX/Android فقط (10003 من Replit — CDN geo-lock):
```
GET  /user/v3/get                [queryUid=...]
GET  /home/v1/list
GET  /home/v10/mine              [pageNum=1, tagId=1, country=EG]
GET  /gift/listV3                [giftVersion=0]
GET  /gift/listPackage
GET  /activity/query             [type=1]
GET  /banned/checkBanned
GET  /room/getRecommendCard
GET  /room/pk/getIsInviteNewMsg
GET  /room/pk/getInfo            [roomId=...]
GET  /room/mic/isMicUpApply      [roomId=..., type=1]
GET  /room/lucky/bag/get         [roomId=...]
GET  /award/email/unread
GET  /user/whitelist/info
GET  /client/pop/up/list
GET  /home/get/continents        ← 200 ✅
GET  /client/configure
GET  /client/init                [faceVersion=0, secondFaceVersion=0]
GET  /activity/room/level/getInfo [roomId=...]
GET  /live/get/last/data/record  [roomUid=...]
GET  /room/getPowerRoom
GET  /fans/following             [pageNo=1, pageSize=20]
GET  /fans/islike                [isLikeUid=...]
GET  /fans/list                  [pageNo=1, pageSize=20]
GET  /client/my/banner
GET  /search/room                [key=...]
GET  /roomctrb/guardian/rank     [guardianUid=..., type=1]
GET  /user/prop/own              [tgUid=...]
POST /sns/moment/list            [pageNo=1, type=0, pageSize=20]
POST /match/cleanBusy
POST /acc/online
POST /user/update/current/language [updateLanguage=en]
POST /sud/game/user/in
POST /uservisitor/visitorRecord  [pageNum=1, pageSize=20]
POST /giftCar/queryHistoryCarList [tgUid=..., pageNo=1, pageSize=20]
POST /headwear/queryHistoryHeadwearList [tgUid=..., pageNo=1, pageSize=20]
POST /sud/game/select/total/record [gameId=1001, targetUid=..., type=0]
POST /room/getTRtcToken          [roomId=..., type=1, channel=0]
POST /imsvr/v1/sendText          [roomId=..., type=1, content=...]
POST /imsvr/v1/v3/fetchRoomMembers [roomId=..., limit=50]
POST /room/rocket/reEnter        [roomUid=..., roomType=3]
POST /room/mic/lockmic           [roomId=..., position=..., state=...]
POST /silvercoin/receiveSilverCoin [missionId=...]  ← code 10038 (mission rules)
POST /oauth/ticket               [access_token, deviceId, issue_type=multi, simCountry]
POST /acc/third/login            [thirdNick, unionId, type, email, turingToken, deviceId, simCountry]
```

---

## 9. سبب الـ 10003 — CDN Geo-Lock (محقق)

**التحقيق:**
1. Headers الـ real app و client متطابقة 100% (فحصناها byte-by-byte من flows_(3))
2. نفس الـ ticket يشتغل على `/purse/query` ويفشل على `/user/v3/get`
3. الـ real app على NOX (IP مصري) → 200 من كل الـ endpoints
4. الـ Replit server (IP أمريكي) → 10003 من معظمها

**السبب:** الـ CDN يوجّه حسب الـ IP:
- IP مصري/خليجي → edge server permissive → 200
- IP أمريكي (Replit/cloud) → edge server strict → يطبّق version check → 10003

**الحل:** تشغيل الطلبات من جهاز محلي في EG/AE/SA، أو VPN بـ exit node عربي.

---

## 10. استخدام الـ API Client

```bash
# عرض الـ session
node re-work/ditto_api.js session

# حفظ session جديد (بعد Frida)
node re-work/ditto_api.js login <access_token> <uid> [deviceId]

# تجديد ticket (من NOX فقط)
node re-work/ditto_api.js refresh

# تجديد تلقائي كل 55 دقيقة (daemon)
node re-work/ditto_api.js daemon

# استدعاء endpoint
node re-work/ditto_api.js call /purse/query
node re-work/ditto_api.js call /home/tab/room tab=POPULAR pageNum=1 pageSize=20
node re-work/ditto_api.js call /giftwall/getUserHistoryReceives tgUid=1090748

# فك تشفير / تشفير
node re-work/ditto_api.js decrypt "<base64>"
node re-work/ditto_api.js encrypt "ticket=abc&uid=123"
```

---

## 11. نتائج البحث عن UIDs

### UID 1090748 (June 24 2026):
```
/giftwall/getUserHistoryReceives → 200 ✅
  totalTypeNum: 281
  totalNum: 684299
  topList:
    - Ice Goddess (giftId: 2698)
    - Moon Castle Delicacies (giftId: 2831)
    - Lion king (giftId: 1455)
```

### UID 281306 (session owner):
```
/purse/query → coin: 310, diamondNum: 2.24
```

### UID 1283476 (session B):
```
/purse/query (from flows) → uid: 1283476, coin: ?, diamondNum: 0
```

---

## 12. الـ ELF / Static Analysis (للرجوع)

| الملف | المسار | الحجم |
|-------|--------|-------|
| libndklib-common.so | `re-work/libs/lib/armeabi-v7a/` | 35,560 bytes |
| المعمارية | ARM32, ELF32, Thumb-2, EABI v5 | — |

### الـ JNI Functions:
```
Java_com_juxiao_jni_JniUtils_getAk     VA 0x2a14  (728 bytes) — AES Key
Java_com_juxiao_jni_JniUtils_getAkIv   VA 0x2cec  (144 bytes) — AES IV
Java_com_juxiao_jni_JniUtils_getDk     VA 0x0a4c  (84  bytes)
Java_com_juxiao_jni_JniUtils_getEk     VA 0x2988  (140 bytes)
.datadiv_decode9961196947225162689     VA 0x564c  (3120 bytes) — XOR decoder
```

### الـ obfuscator:
Obfuscator-LLVM datadiv — يشفر strings في .data بـ XOR مع 64-bit constants، يُفك عند load بـ .init_array constructor.

---

## 13. تحذيرات

```
❌ QEMU   → crash سابق للبيئة
❌ JADX   → crash
❌ baksmali → segfault
✅ Node.js, readelf, unzip, git فقط
```

---

## 14. ملفات المجلد

```
re-work/
├── ditto_api.js              ← API client كامل (الأداة الرئيسية)
├── ditto_session.json        ← session حالي
├── frida_hook_ditto.js       ← Frida hook
├── decrypt_ditto.js          ← decrypt/encrypt CLI بسيط
├── libs/
│   └── lib/armeabi-v7a/
│       ├── libndklib-common.so
│       └── libsigner.so
└── memory/
    ├── RE_PROGRESS.md        ← هذا الملف
    ├── data_section_raw.txt  ← .data section hex dump (1057 bytes)
    ├── datadiv_decode_raw.txt ← datadiv decoder function (3120 bytes)
    └── key_functions_raw.txt  ← key getter functions raw bytes
```

---

## 15. سكربت الاستئناف السريع (لو انهارت البيئة)

```bash
# التحقق
ls /home/runner/workspace/re-work/libs/lib/armeabi-v7a/

# إعادة التحميل لو ضروري
git clone --depth=1 https://github.com/hmdagency3-boop/-.git /home/runner/workspace/re-work/repo
cd /home/runner/workspace/re-work
unzip -o "repo/Ditto+Live+-Match&meet+someone_1.3.4.0_APKPure.xapk" -d xapk_extracted/
mkdir -p libs
unzip -o "xapk_extracted/config.armeabi_v7a.apk" "lib/armeabi-v7a/libndklib-common.so" -d libs/

# إعادة الـ session
cat > ditto_session.json << 'EOF'
{
  "uid": "281306",
  "ticket": "e3e7bc6d30eaa492746ba3c242253007",
  "access_token": "ed93ba1f476a042efd8b86ed851234bb",
  "deviceId": "27e0073c1e0d132a0b66a84ff8ada5baa",
  "ticket_saved_at": 1782326333345,
  "access_token_saved_at": 1782326333345
}
EOF

# تجديد ticket (من NOX/Frida)
# frida -U com.ditto.mobile -l re-work/frida_hook_ditto.js
# ثم:
# node re-work/ditto_api.js login <new_access_token> 281306

# اختبار
node re-work/ditto_api.js call /purse/query
```
