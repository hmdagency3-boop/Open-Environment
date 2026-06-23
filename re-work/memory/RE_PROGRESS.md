# Ditto Live APK — Reverse Engineering Progress File
**تاريخ آخر تحديث:** 2026-06-23  
**الهدف:** استخراج مفاتيح AES من libndklib-common.so لفك تشفير حقل `ed` في API التطبيق

---

## 1. معلومات التطبيق

| البيان | القيمة |
|--------|--------|
| اسم التطبيق | Ditto Live - Match & Meet Someone |
| Package Name | `com.ditto.mobile` |
| الإصدار | 1.3.4.0 |
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
# git-lfs متاح في البيئة ويشتغل تلقائي مع clone
```

### استخراج الـ XAPK:
```bash
cd /home/runner/workspace/re-work
mkdir -p xapk_extracted
unzip -o "repo/Ditto+Live+-Match&meet+someone_1.3.4.0_APKPure.xapk" -d xapk_extracted/
# ينتج:
#   com.ditto.mobile.apk     (80MB) — الـ APK الرئيسي (لا يحتوي .so)
#   config.armeabi_v7a.apk  (66MB) — يحتوي على كل ملفات .so ⬅️ المهم
#   config.mdpi.apk
#   manifest.json
```

### استخراج المكتبة المستهدفة:
```bash
mkdir -p libs
unzip -o "xapk_extracted/config.armeabi_v7a.apk" \
  "lib/armeabi-v7a/libndklib-common.so" \
  "lib/armeabi-v7a/libsigner.so" \
  -d libs/
# الناتج في: libs/lib/armeabi-v7a/
```

---

## 3. الملف المستهدف: libndklib-common.so

| البيان | القيمة |
|--------|--------|
| المسار | `libs/lib/armeabi-v7a/libndklib-common.so` |
| الحجم | 35,560 bytes (35KB) |
| المعمارية | ARM32, ELF32, Little Endian |
| ABI | Thumb-2, EABI v5, soft-float |
| النوع | DYN (Shared Object) |

---

## 4. الـ ELF Sections المهمة

```
Section Name     Type        VA        File Offset  Size
.text            PROGBITS    0x9f8     0x9f8        0x591e  (كود)
.init_array      INIT_ARRAY  0xbe8c    0x7e8c       0x4     (constructor واحد فقط!)
.fini_array      FINI_ARRAY  0xbe84    0x7e84       0x8
.data            PROGBITS    0xc000    0x8000       0x421   (1057 bytes — المفاتيح المشفرة هنا)
.bss             NOBITS      0xc424    0x8424       0x50
```

**الملاحظة المهمة:** `.init_array` حجمه 4 bytes فقط = pointer واحد = constructor واحد بس، وهو دالة `.datadiv_decode`

---

## 5. الـ JNI Functions المُصدَّرة

**Package:** `com.juxiao.jni.JniUtils` (مش `com.ditto`! — هذا اسم المطور الأصلي)

```
Function Name                                    VA      File Offset  Size
Java_com_juxiao_jni_JniUtils_getDk              0x0a4d  0x0a4c       84 bytes  — Decrypt Key
Java_com_juxiao_jni_JniUtils_getEk              0x2989  0x2988       140 bytes — Encrypt Key
Java_com_juxiao_jni_JniUtils_getAkIv            0x2ced  0x2cec       144 bytes — AES IV
Java_com_juxiao_jni_JniUtils_getAk              0x2a15  0x2a14       728 bytes — AES Key (main)
Java_com_juxiao_jni_JniUtils_getNetEaseKey      0x2d7d  0x2d7c       704 bytes
Java_com_juxiao_jni_JniUtils_getAgoraKey        0x303d  0x303c       372 bytes
.datadiv_decode9961196947225162689              0x564d  0x564c       3120 bytes — XOR decoder
```

**ملاحظة Thumb:** كل العناوين الـ JNI بتبدأ بـ odd address (bit0=1 = Thumb mode). الـ file offset = VA & ~1

---

## 6. آلية التشفير (المفهومة حتى الآن)

```
التدفق:
1. عند تحميل .so → .init_array تستدعي .datadiv_decode9961196947225162689
2. الدالة دي تعمل XOR على chunks في .data section (0x8000)
3. بعد الـ decode، .data بيحتوي على المفاتيح بشكل plain text
4. getDk / getAk / getAkIv / getEk = دوال صغيرة بترجع pointers لمحتوى .data
5. في Java/Kotlin: JniUtils.getAk() → AES Key, JniUtils.getAkIv() → AES IV
```

**الخوارزمية المستخدمة:**
- AES (مؤكد من DEX: `com.ditto.ditto_framework.aes.JniAesKit`)
- الـ mode والـ padding: مش محدد بعد (الأغلب AES/CBC/PKCS5)
- الـ obfuscator: **Obfuscator-LLVM datadiv** — يشفر strings بـ XOR مع constants 64-bit

---

## 7. الـ .data Section (الخام — قبل الـ decode)

**الملف الكامل:** `memory/data_section_raw.txt`

### مقتطفات مهمة:
```
8000: ff ff ff ff a7 a5 b4 90 a1 a3 ab a1 a7 a5 8e a1
8010: ad a5 c0 00 ...  (entry 1: 24 bytes?)
8020: 60 61 04 22 29 3e 29 67 24 29 26 2f 67 1b 3c 3a  (entry 2)
8030: 21 26 2f 73 48 50 52 43 67 56 54 5c 56 50 52 7e
8040: 59 51 58 37 00 ...  (ends here)
...
80c0: hashCode.YX8q  ← هذا plain text! (مش مشفر أو XOR = صفر)
```

**هيكل كل entry:** `[encoded_bytes][0x00 padding للـ alignment]`

---

## 8. الـ datadiv Decoder

**الملف الكامل:** `memory/datadiv_decode_raw.txt`

**الموقع:** file offset `0x564c`، حجم `3120 bytes`

### أول 4 bytes:
```
564c: 2d e9 f0 4f   → PUSH {R4-R11, LR}  (ARM Thumb-2 function prologue)
```

### الـ constants (في نهاية الدالة كـ PC-relative data):
```
624c: 64 63 00 00   → 0x00006364
6250: 52 63 00 00   → 0x00006352
6254: 36 63 00 00   → 0x00006336
6258: 08 63 00 00   → 0x00006308
625c: dc 62 00 00   → 0x000062dc
6260: a6 62 00 00   → 0x000062a6
6264: 6c 62 00 00   → 0x0000626c
6268: 60 62 00 00   → 0x00006260
626c: 4a 62 00 00   → 0x0000624a
6270: 10 62 00 00   → 0x00006210
6274: f4 61 00 00   → 0x000061f4
6278: f0 61 00 00   → 0x000061f0
```
(هذه addresses داخل الدالة نفسها — pointers لـ sub-routines أو decode blocks)

---

## 9. الـ Payload المطلوب فك تشفيره

```
Encoded (Base64):
cEv/pIPnU8Ebmn2Z0EgQasesl/RuJMn/NffZtuQw+ZDMJvcny4fL8NhM8NCennBlJOtFiqA0N1LUxvm6f0+bBhCHe7NCti6/YCrz7T60yoxxneSnHD28s+ITSeDXDT4n/Ozs0A0GekKrxAX5iCG32SCFaWE0ksi5wOrAUnFzE3kFb2KmokgNy7uUokSKvV/yBBcE/moKnZT+0t7UfpheBtmGs2ctj8oqRZDXb6Yvi7qL3lvX6Wa2/RA7dBS2RNadGzScfSY5/ozoJVeMQoxdytX1OQqcnBerZO/5hSXlgvnB2XsoSTkF0PQHG82HpFgk

API Endpoint: getTRtcToken
Field: ed (Application Layer Encryption)
```

---

## 10. الأدوات المتاحة في البيئة

| الأداة | متاحة؟ | ملاحظة |
|--------|---------|--------|
| Node.js | ✅ | الأداة الرئيسية للتحليل |
| git + git-lfs | ✅ | لتحميل الـ XAPK |
| unzip | ✅ | لاستخراج APK/XAPK |
| readelf | ✅ | لتحليل ELF headers |
| objdump | ⚠️ | موجود لكن لا يدعم ARM |
| python3 | ❌ | غير موجود |
| strings | ❌ | غير موجود |
| xxd | ❌ | غير موجود، استخدم Node.js بدلاً منه |
| QEMU | 💀 | **سبب انهيار البيئة السابقة — ممنوع تماماً** |
| JADX | 💀 | **كان يـ crash — ممنوع** |
| baksmali | 💀 | **segfault — ممنوع** |

---

## 11. الخطوات المكتملة ✅

- [x] تحميل XAPK من GitHub LFS
- [x] استخراج `config.armeabi_v7a.apk`
- [x] استخراج `libndklib-common.so` و `libsigner.so`
- [x] تحليل ELF header وكل الـ sections
- [x] استخراج كل الـ JNI function names والعناوين
- [x] dump الـ .data section الخام (1057 bytes) → محفوظ في `data_section_raw.txt`
- [x] dump دالة datadiv_decode الكاملة (3120 bytes) → محفوظ في `datadiv_decode_raw.txt`
- [x] dump كل دوال الـ key getters → محفوظ في `key_functions_raw.txt`

---

## 12. الخطوة التالية (المتبقية) ⏳

### المشكلة:
البيانات في `.data` مشفرة بـ XOR بواسطة `datadiv_decode`. لازم نفهم الـ XOR constants.

### الحل المقترح (Static Analysis بـ Node.js):
```
الخطوة A: نكتب ARM Thumb-2 mini-parser بـ Node.js
  - نقرأ bytes دالة datadiv_decode من 0x564c
  - نبحث عن pattern: MOVW/MOVT (تحميل constant 32-bit)
  - نبحث عن EOR (XOR instruction في ARM Thumb)
  - نستخرج الـ constants وعناوين الـ .data التي يتم XOR عليها

الخطوة B: نطبق XOR على .data section
  - بعد معرفة الـ constants → نطبقها على bytes الـ .data
  - نطبع النتيجة كـ strings

الخطوة C: نحدد مفاتيح AES
  - getDk → Decrypt Key (32 bytes = AES-256 key)
  - getAkIv → AES IV (16 bytes)
  - getAk → AES Key (للتشفير)
  - getEk → Encrypt Key

الخطوة D: نكتب سكربت Python/Node لفك تشفير الـ payload
  - AES-CBC أو AES-GCM مع الـ key والـ IV
  - نفك base64 → decrypt → JSON
```

### بديل أسرع (إذا فشل التحليل):
```
نجرب XOR keys شائعة مع أول entry في .data:
- Entry at 0x8020 (36 bytes): `60 61 04 22 29 3e 29 67...`
- XOR مع "ditto", "juxiao", "AES_KEY_", إلخ
- نشوف لو النتيجة printable ASCII
```

---

## 13. الـ raw bytes للـ .data (للرجوع السريع)

```
8000: ff ff ff ff a7 a5 b4 90 a1 a3 ab a1 a7 a5 8e a1
8010: ad a5 c0 00 00 00 00 00 00 00 00 00 00 00 00 00
8020: 60 61 04 22 29 3e 29 67 24 29 26 2f 67 1b 3c 3a
8030: 21 26 2f 73 48 50 52 43 67 56 54 5c 56 50 52 7e
8040: 59 51 58 37 00 00 00 00 00 00 00 00 00 00 00 00
8050: 0d 69 4f 44 53 44 0a 49 44 4b 42 0a 76 51 57 4c
8060: 4b 42 1e 6c 0c 69 44 4b 41 57 4a 4c 41 0a 46 4a
8070: 4b 51 40 4b 51 0a 55 48 0a 75 44 46 4e 44 42 40
8080: 6c 4b 43 4a 1e 25 29 33 3d 34 3b 2e 2f 28 3f 29
8090: 5a 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
80a0: 1b 0c 21 2e 24 32 2f 29 24 6f 23 2f 2e 34 25 2e
80b0: 34 6f 30 2d 6f 13 29 27 2e 21 34 35 32 25 7b 40
80c0: 68 61 73 68 43 6f 64 65 00 59 58 38 71 00 00 00
80d0: 8f 8d 9c b8 89 8b 83 89 8f 8d a5 89 86 89 8f 8d
80e0: 9a e8 00 00 00 00 00 00 00 00 00 00 00 00 00 00
80f0: 8f 8e eb c6 c9 c3 d5 c8 ce c3 88 c4 c8 c9 d3 c2
8100: c9 d3 88 d7 ca 88 f7 c6 c4 cc c6 c0 c2 ea c6 c9
8110: c6 c0 c2 d5 9c a7 00 00 00 00 00 00 00 00 00 00
8120: 6c 39 6e 3b 3f 6f 6e 3e 3e 3b 6a 6f 3c 65 6c 65
8130: 65 6c 6d 6e 6a 65 6e 68 6d 6e 6b 3e 6f 64 3b 6c
8140: 6b 39 5d 00 00 00 00 00 00 00 00 00 00 00 00 00
8150: 0a 0c 0e 58 5f 0c 5f 59 58 0f 08 0a 09 5b 04 09
8160: 5c 05 05 5e 5e 5b 0f 59 5e 5f 59 0f 05 5b 0d 0d
8170: 3d 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
8180: ae ae ad ae af fa fd fc af f5 f8 ae f8 f5 f5 f9
8190: ae af ae fa af ae f5 a8 fd f9 a8 fe af fa a8 f9
81a0: cc c6 85 9a cf cc cf 9c 9a cd cd ff 00 00 00 00
81b0: f7 a6 a6 f3 f4 a3 fa a3 a7 f1 a4 a1 f6 a1 a1 f5
81c0: fb f7 f7 f7 f4 a0 a0 f3 a4 f2 f6 f3 a1 a4 fa f1
81d0: c2 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
81e0: ad ab af ae fc a1 a8 fa a0 ab a8 af ad fb f8 fd
81f0: a0 fd fd fd a9 fb fb ff fb ae fb ac fc ac a0 f8
8200: 99 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
8210: 14 67 47 15 1e 43 13 40 16 12 40 15 1f 44 17 17
8220: 43 42 26 00 00 00 00 00 00 00 00 00 00 00 00 00
8230: 2e 2f 75 76 2e 26 72 71 75 2e 73 73 23 23 2f 25
8240: 2e 21 24 21 74 74 24 25 20 74 20 72 74 74 25 72
8250: 17 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
8260: fc f3 f4 fd f7 a6 f5 a0 a4 f2 fd a4 f1 f0 f1 a7
8270: fc f7 a7 fc a4 f7 a0 f4 a6 fd fc a3 a0 f7 f1 f4
8280: c5 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
8290: f7 b2 be be b2 e3 b6 b6 b7 b0 b5 e3 b6 b4 e4 b4
82a0: b0 e3 86 00 00 00 00 00 00 00 00 00 00 00 00 00
82b0: 06 01 51 55 07 01 05 07 07 00 08 04 07 05 01 51
82c0: 54 53 30 00 00 00 00 00 00 00 00 00 00 00 00 00
82d0: a7 f0 a6 a7 a7 a6 a1 a6 f4 fa f0 a7 f0 f5 a1 f2
82e0: f2 f6 c3 00 00 00 00 00 00 00 00 00 00 00 00 00
82f0: d1 c7 ae f5 af f5 f2 f2 a7 ae ae a3 f4 f6 af a1
8300: a7 f4 f1 a4 af a2 f5 f2 f2 a7 af ae a0 ae a2 a3
8310: f4 ae 97 00 00 00 00 00 00 00 00 00 00 00 00 00
8320: 60 60 6c 3d 6c 60 68 6e 3c 6a 3d 6a 6c 68 61 69
8330: 39 39 6a 6f 6e 3e 3e 39 6c 6c 6a 3b 3e 69 61 6e
8340: 58 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
8350: 28 7c 2f 2f 29 7b 7d 2b 2a 2d 2f 7a 2b 27 2b 7a
8360: 27 2a 2e 7d 28 26 2e 28 2a 29 26 2e 2f 2b 29 7d
8370: 1f 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
8380: d2 89 81 d2 87 87 d3 89 82 86 d4 84 87 88 84 80
8390: 86 d3 d1 d5 83 81 87 84 d3 d5 80 85 86 85 d4 d2
83a0: 84 d2 b0 00 00 00 00 00 00 00 00 00 00 00 00 00
83b0: e4 b8 be b9 e4 eb bd ba bf ea bd ee e8 ec b8 e8
83c0: bd ec ba e5 e9 bd b8 ba bf e4 ed ef ef e5 e4 ee
83d0: dc 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
83e0: c8 c7 ca 9d cd cc ce cd cc c7 9e c6 cb c6 cc ca
83f0: 9e ca c6 cf 9b c9 ca ce cb 9a c8 9a 9a c9 9d cb
8400: ff 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
8410: c2 ce cc 8f c5 c8 d5 d5 ce 8f cc ce c3 c8 cd c4
8420: a1
```

---

## 14. تحليل هيكل الـ .data entries

الملاحظة: كل entry بيتبعها bytes من `0x00` للـ alignment. وفي نهاية كل entry يوجد byte يشبه length.

```
Entry #  File Offset  Raw Size  Last Byte (possible len?)
1        0x8000       24        0xc0 = 192? (لا يعني شيء واضح)
2        0x8020       36        0x37
3        0x8050       65        0x5a
4        0x80a0       49        0x40 (ends at 80c0 → "hashCode" text!)
5        0x80d0       25        0xe8
...
```

---

## 15. ملاحظة مهمة: `hashCode` في .data

عند offset `0x80c0`:
```
80c0: 68 61 73 68 43 6f 64 65 00   →  "hashCode\0"  (plain text!)
80c9: 59 58 38 71 00               →  "YX8q\0"      (plain text!)
```

هذا يعني أن هذه الـ strings **لم تُشفَّر** — أو أن الـ XOR key لهذه المنطقة = صفر.
ده بيساعد في التحقق من صحة الـ decode لاحقاً.

---

## 16. تحذيرات (لا تفعل هذا!)

```
❌ لا تشغّل QEMU أو أي ARM emulator → سبب الـ crash السابق
❌ لا تشغّل JADX → كان يـ crash
❌ لا تشغّل baksmali → segfault
❌ لا تشغّل أي binary ARM مباشرة في البيئة
✅ استخدم فقط: Node.js, readelf, unzip, git, od
```

---

## 17. ملفات محفوظة في هذا المجلد

```
memory/
├── RE_PROGRESS.md              ← هذا الملف (الدليل الرئيسي)
├── data_section_raw.txt        ← .data section hex dump كامل (1057 bytes)
├── datadiv_decode_raw.txt      ← datadiv decoder function hex dump (3120 bytes)
└── key_functions_raw.txt       ← كل دوال الـ key getters raw bytes
```

---

## 18. سكربت الاستئناف السريع (للشات الجديد)

لو البيئة انهارت، الملفات ما زالت موجودة في `/home/runner/workspace/re-work/`. استخدم هذا:

```bash
# التحقق أن الملفات موجودة
ls /home/runner/workspace/re-work/libs/lib/armeabi-v7a/
ls /home/runner/workspace/re-work/memory/

# لو مش موجودة، أعد التحميل:
git clone --depth=1 https://github.com/hmdagency3-boop/-.git /home/runner/workspace/re-work/repo
cd /home/runner/workspace/re-work
unzip -o "repo/Ditto+Live+-Match&meet+someone_1.3.4.0_APKPure.xapk" -d xapk_extracted/
mkdir -p libs
unzip -o "xapk_extracted/config.armeabi_v7a.apk" "lib/armeabi-v7a/libndklib-common.so" -d libs/

# الخطوة التالية:
# → اكتب Node.js script لـ parse ARM Thumb-2 XOR instructions من datadiv_decode
# → الملف: memory/datadiv_decode_raw.txt
# → الهدف: استخراج XOR constants لـ decode الـ .data section
```

---

*آخر تحديث: 2026-06-23 — البيئة شغالة، الملفات محملة، الخطوة التالية: تحليل datadiv XOR constants*
