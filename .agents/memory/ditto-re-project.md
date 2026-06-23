---
name: Ditto Live APK Reverse Engineering
description: Full state of RE project — libndklib-common.so XOR keys, AES candidates, network flows, decryption blocker
---

## Goal
Decrypt the `ed` field in API responses from `www.sayyouditto.com`.
App: `com.ditto.mobile` v1.3.4.0 APK.

## Key Files
```
re-work/libs/lib/armeabi-v7a/libndklib-common.so   ← main target
re-work/xapk_extracted/com.ditto.mobile.apk         ← full APK
re-work/analyze_datadiv.js    ← .data section XOR analysis
re-work/analyze_keys.js       ← AES key candidates extraction
re-work/decrypt_payload.js    ← AES decryption attempts (all failed)
re-work/parse_flows.js        ← mitmproxy tnetstring parser (works)
attached_assets/flows_1782235851805   ← mitmproxy flow file (29 flows)
/tmp/dex_out/classes*.dex             ← extracted DEX files (ephemeral — re-extract each session)
```

## DEX Extraction (run at session start — ephemeral)
```bash
cd /tmp && unzip -o /home/runner/workspace/re-work/xapk_extracted/com.ditto.mobile.apk \
  'classes*.dex' -d /tmp/dex_out
```
Also install: `npm install sm-crypto` (in workspace root)

## .so Structure
- `.data` section: VA=0xC000, file offset=0x8000, size=0x421
- `datadiv_decode` function: file offset 0x564c, size 3120 bytes
- Contains 26 XOR-obfuscated string entries (OLLVM datadiv technique)

## XOR Obfuscation — Confirmed Rules
- Each entry is a null-terminated string XOR'd with a SINGLE repeating byte key
- **Key = last raw (encoded) byte of the entry** (because decoded null XOR key = 0)
- Entry boundaries parsed by scanning for 0x00 bytes in raw .data

## ALL 26 .data Entries — Fully Decoded
| # | File Offset | VA     | len | key  | decoded                                        |
|---|-------------|--------|-----|------|------------------------------------------------|
| 1  | 0x8000 | 0xc000 | 19  | 0xc0 | "????getPackageName"                           |
| 2  | 0x8020 | 0xc020 | 36  | 0x37 | "WV3...getPackageInfo" (obfuscated)            |
| 3  | 0x8050 | 0xc050 | 65  | 0x5a | "[Landroid/content/pm/Signature;"              |
| 4  | 0x80a0 | 0xc0a0 | 40  | 0x65 | "~iDKAWJLA..." (binary/obfuscated)             |
| 5  | 0x80c9 | 0xc0c9 | 4   | 0x71 | "()I"                                          |
| 6  | 0x80d0 | 0xc0d0 | 18  | 0xe8 | "getPackageManager"                            |
| 7  | 0x80f0 | 0xc0f0 | 38  | 0xa7 | "()Landroid/content/pm/PackageManager;"        |
| **8**  | **0x8120** | **0xc120** | 35 | **0x5d** | **"1d3fb23ccf72a81881037835036c29f16d"** ← 34 chars! |
| **9**  | **0x8150** | **0xc150** | 33 | **0x3d** | **"713eb1bde2574f94a88ccf2dcbd28f00"** ← 32 chars = getDk |
| 10 | 0x8180 | 0xc180 | 44  | 0xff | "QQRQP...39ze030ce22" (binary)                 |
| **11** | **0x81b0** | **0xc1b0** | 33 | **0xc2** | **"5dd16a8ae3fc4cc795556bb1f041cf83"** ← getEk |
| **12** | **0x81e0** | **0xc1e0** | 33 | **0x99** | **"4267e81c92164bad9ddd0bbfb7b5e59a"**          |
| 13 | 0x8210 | 0xc210 | 19  | 0x26 | "2Aa38e5f04f39b11ed" (uppercase A — not pure hex) |
| **14** | **0x8230** | **0xc230** | 33 | **0x17** | **"98ba91efb9dd44829636cc327c7ecc2e"**          |
| **15** | **0x8260** | **0xc260** | 33 | **0xc5** | **"96182c0ea78a454b92b9a2e1c89fe241"**          |
| 16 | 0x8290 | 0xc290 | 19  | 0x86 | "q4884e00163e02b26e" ('q' — not pure hex)      |
| 17 | 0x82b0 | 0xc2b0 | 9   | 0x07 | "..VR...." (8 binary bytes)                    |
| 18 | 0x82ba | 0xc2ba | 9   | 0x30 | "84751adc" (8 ASCII chars)                     |
| 19 | 0x82d0 | 0xc2d0 | 19  | 0xc3 | "d3eddebe793d36b115" (18 hex chars)             |
| 20 | 0x82f0 | 0xc2f0 | 35  | 0x97 | "FP9b8bee0994ca860cf385bee0897954c9" (NetEase) |
| **21** | **0x8320** | **0xc320** | 33 | **0x58** | **"884e4806d2e24091aa276ffa442cf196"**          |
| **22** | **0x8350** | **0xc350** | 33 | **0x1f** | **"7c006db4520e484e851b79175691046b"**          |
| 23 | 0x8380 | 0xc380 | 35  | 0xb0 | "b91b77c926d478406cae3174ce0565db4b" (Agora)   |
| **24** | **0x83b0** | **0xc3b0** | 33 | **0xdc** | **"8dbe87afc6a240d4a0f95adfc8133982"**          |
| **25** | **0x83e0** | **0xc3e0** | 33 | **0xff** | **"785b231238a94935a590d6514e7ee6b4"**          |
| 26 | 0x8410 | 0xc410 | 17  | 0xa1 | "com.ditto.mobile"                             |

**Bold = 32 hex char strings (16-byte AES-128 key candidates: entries 9,11,12,14,15,21,22,24,25)**
**Entry 8 = 34 chars — unusual, may be prefix+32 or different use**

## Key Getter Functions → .data Pointer Mappings (CORRECTED)
| Function      | .so offset | Returns to VA    | entry # decoded                   |
|---------------|------------|------------------|-----------------------------------|
| getDk         | 0x0a4c    | 0xC120 / 0xC150  | entry 8 (34-char) or entry 9 (32-char) |
| getEk         | 0x2988    | ~0xC1b0          | entry 11 "5dd16a8ae3fc..."        |
| getAk         | 0x2a14    | 0xC230 area      | entry 14 "98ba91ef..."            |
| getAkIv       | 0x2cec    | 0xC2A8 / 0xC2D0  | entry 18 "84751adc" or entry 19   |
| getNetEaseKey | 0x2d7c    | 0xC2F0           | entry 20 "FP9b8bee..."            |
| getAgoraKey   | 0x303c    | 0xC3E0           | entry 25 "785b23..."              |

getLiteral pool for getDk (0xa94-0xa9c): 0xB69A, 0xB6C8, 0xB6F6
- 0xB69A + PC(0xa86+4) → VA 0xC120 = entry 8 (34-char key — UNUSUAL)
- 0xB6C8 + PC(0xa88+4) → VA 0xC150 = entry 9 (32-char = "713eb1bde2574f94a88ccf2dcbd28f00")

## Cipher Algorithm — Confirmed from DEX
- `AES/CBC/PKCS5PADDING` in classes3.dex ← confirmed HTTP API cipher
- `Lcom/ditto/ditto_framework/aes/JniAesKit;` ← the Java wrapper class
- `Lcom/ditto/ditto_framework/des/DESKit;` ← DES variant (different purpose?)
- `Lcom/ditto/ditto_framework/sign/SignKit;` ← signing
- `getDk`, `getEk` — JNI native method names called from JniAesKit
- `getTmpSecretKey`, `getQnSecretKey` — also in classes.dex (session/Qiniu keys?)
- `RSA/ECB/PKCS1Padding` — also present but likely different feature

## Ciphertext Structure (CONFIRMED)
- loginCT: **352 bytes = 22 × 16** ✓ (valid AES-128 CBC)  ← previously miscalculated as 392!
- okCT: **48 bytes = 3 × 16** ✓ (valid AES-128 CBC)
- All ciphertexts are multiples of 16 → PKCS5 padded AES-128 CBC confirmed

## Critical Observations on Ciphertext Patterns
- **ALL large API responses share SAME first ciphertext block (C[0]):**  
  `704bffa483e753c11b9a7d99d048106a`
  → Fixed IV + fixed key + same first 16 bytes of plaintext for all responses
  → First 16 bytes of plaintext likely `{"code":0,"data":` (16 chars exactly)

- **Request ed first blocks per flow:**
  - Flow 0 (login): `006ecf026aeb9d5843e727310b3f4b96` (unique)
  - Flow 1 (ticket): `4d7a17d7ba69267965becf4355617004` (unique)
  - Flows 8,9,12,13 (POST to different endpoints): ALL share `5e43c6a04e19d6beb4bdd01686748af9`
  → Request ed also uses fixed IV!

## DEX Hex Strings Found (potential keys/IVs — NOT from .so)
From `classes.dex`:
- `100d26b02f61c1b1e489184cd4db4955` (32 hex = 16 bytes)
- `498b35e400dc87536461e4d6d353505c`
- `0123456789ABCDEF` (16 ASCII = test pattern?)
- `9774d56d682e549c` (16 hex = 8 bytes)

From `classes3.dex`:
- `1ea53d260ecf11e7b56e00163e046a26`

From `classes5.dex`:
- `021cc0370d824a51b7c8180485c27b38`
- `236e7ec1d4b721c997c1a5f549ebbce8`
- `45c6af3c98409b18a84451215d0bdd6e`
- `2fec6c3877b72f5cfb6fc7430b458516`
- `b167f75a566c403d8e9ac33d311a6b7c`
- `c3edf5f1f69d9bf76a4373508915a257`
- `c9dd38f1bc660ce9440d44a6876d3f5d`
- `fe416640c8e8a72734219e1847ad2547`

## SM4 Status
- SM4 found in classes5.dex ("SM4 requires a 128 bit key") and classes6.dex ("SM4_128_ECB")
- SM4 attempts with all 9 .so keys × all IV candidates → **ALL FAILED**
- `sm-crypto` npm package available for SM4 in Node.js

## Decryption Attempts — ALL FAILED (complete record)
Tried all combos of:
- **Keys:** 9 hex-decoded 16-byte candidates from .so entries 9,11,12,14,15,21,22,24,25
- **Also:** Entry 8 first 32 chars, last 32 chars, 34-char entry as various
- **Modes:** AES-128-CBC, AES-128-ECB, AES-256-CBC (32-char hex as ASCII), SM4-CBC, SM4-ECB, DES-CBC, 3DES-CBC
- **IVs:** zeros, all-ff, first-16-bytes-of-CT, all 10 DEX hex strings as IVs
- **Derived keys:** MD5/SHA256/SHA1 of key strings, XOR pairs of keys
- **IV-independent test:** Decrypt C[1:] with IV=C[0] (bypasses IV) → all scores ~0.35-0.50, nothing readable
- **Conclusion: None of the extracted keys are correct, OR the key derivation involves more steps than simple XOR decode**

## Backward AES Analysis (Finding IV from Known Plaintext)
Given C[0] = `704bffa483e753c11b9a7d99d048106a` is shared across all responses:
- For each key K: IV_candidate = AES_K_inv(C[0]) XOR assumed_P[0]
- Tested P[0] = `{"code":0,"data":` with all 9 keys
- None of the derived IVs matched any known pattern (zeros, known strings, etc.)
- **Interpretation:** Either assumed P[0] is wrong OR our keys are wrong

## Open Questions / Next Investigation Paths (Priority Order)

### HIGHEST PRIORITY
1. **Re-examine getDk in .so disassembly**  
   The 34-char entry 8 at VA 0xC120 is anomalous — maybe getDk returns a pointer INTO entry 8's middle (e.g., chars 2-17 = 16 bytes from "1d3f..."), not the start.
   
2. **Find how JniAesKit calls getDk in Java bytecode**  
   Parse classes.dex class_defs to find JniAesKit's method code, then look for string refs (key/IV loading pattern). The DEX type idx for JniAesKit is 8499 in classes.dex (but class_def parsing has range errors — fix the ULEB128 parsing).

3. **Known-plaintext attack using request ed**  
   Request flows 8,9,12,13 all share first block `5e43c6a04e19d6beb4bdd01686748af9`.  
   Likely plaintext starts with `{"userId":` or similar known JSON.
   Use: for each of 9 keys → try AES_K_inv(C[0]) XOR P[0] = IV → verify with C[1]

4. **Check if entry 8's 34-char string is actually hex with 1-byte prefix**  
   "1d" could be a version/length byte, and the real key is "3fb23ccf72a81881037835036c29f16d" (32 chars = bytes 2-17 of the decoded string, skipping first 2 chars).

5. **getDk may use entry 9 (0xC150) not entry 8 (0xC120)**  
   Both are plausible targets from the literal pool. Entry 9 = "713eb1bde2574f94a88ccf2dcbd28f00" (cleanly 32 hex chars).
   Still failed with IV-independent test but maybe the IV is NOT random and NOT in our list.

### KEY INSIGHT NEEDED
The ciphertext pattern (fixed C[0] across all responses) proves the IV must be FIXED and CONSTANT. It must exist SOMEWHERE in the app. We haven't found it yet because:
- It might be hardcoded as binary (not hex-string) in the .so binary data section
- It might be in a different .so file (other libs in the APK)
- It might be derived at runtime from app constants

## Other .so Files in APK (check these!)
```bash
unzip -l re-work/xapk_extracted/com.ditto.mobile.apk | grep '\.so'
# Look for: libndklib-common.so AND any other libs that might have keys
```

## Server Info
- Host: `www.sayyouditto.com`
- Login endpoint: `POST /acc/third/login`
- Auth flow: login → /oauth/ticket → /acc/online → rest of API
- All requests: `ed=<url-encoded-base64>` in body (POST) or query (GET)
- All responses: `{"ed":"<base64>"}` (encrypted JSON)
- Response flow to check: flows where response has "ok" status (likely `{"code":0,"msg":"ok"}`)
