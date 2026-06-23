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
attached_assets/flows_1782235851805   ← NEW mitmproxy flow file (29 flows)
re-work/memory/flows_decoded.txt      ← OLD flow dump (pre-compression)
/tmp/dex_out/classes*.dex             ← extracted DEX files (ephemeral)
```

## .so Structure
- `.data` section: VA=0xC000, file offset=0x8000, size=0x421
- `datadiv_decode` function: file offset 0x564c, size 3120 bytes
- Contains 26 XOR-obfuscated string entries (OLLVM datadiv technique)

## XOR Obfuscation — Confirmed Rules
- Each entry is a null-terminated string XOR'd with a SINGLE repeating byte key
- **Key = last raw (encoded) byte of the entry** (because decoded null XOR key = 0)
- Entry boundaries parsed by scanning for 0x00 bytes in raw .data
- Verified with: "com.ditto.mobile" (key=0xa1), "[Landroid/content/pm/Signature;" (key=0x40), "()Landroid/content/pm/PackageManager;" (key=0xa7)

## 26 .data Entries — Notable Decoded Values
| # | VA     | file   | len | key  | decoded                              |
|---|--------|--------|-----|------|--------------------------------------|
| 0 | 0xc000 | 0x8000 | 19  | 0xc0 | "????getPackageName" (4-byte header?) |
| 3 | 0xc0a0 | 0x80a0 | 40  | 0x40 | "[Landroid/content/pm/Signature;"     |
| 6 | 0xc0f0 | 0x80f0 | 38  | 0xa7 | "()Landroid/content/pm/PackageManager;" |
| **8** | 0xc150 | 0x8150 | 33 | **0x3d** | **"713eb1bde2574f94a88ccf2dcbd28f00"** ← AES key candidate |
| **11** | 0xc1e0 | 0x81e0 | 33 | **0x99** | **"4267e81c92164bad9ddd0bbfb7b5e59a"** ← AES key candidate |
| **13** | 0xc230 | 0x8230 | 33 | **0x17** | **"98ba91efb9dd44829636cc327c7ecc2e"** ← AES key candidate |
| **21** | 0xc350 | 0x8350 | 33 | **0x1f** | **"7c006db4520e484e851b79175691046b"** ← AES key candidate |
| 25 | 0xc410 | 0x8410 | 17  | 0xa1 | "com.ditto.mobile"                    |

Also noted (not yet cleanly decoded as hex):
- Entry 12 (0x8210, len=19) key=0x26 → "2Aa38e5f04f39b11ed" (18 chars, not standard hex)
- Entry 15 (0x8290, len=19) key=0x86 → "q4884e00163e02b26e"
- Entry 19 (0x82f0, len=35) key=0x97 → "FP9b8bee0994ca860cf385bee0897954c9" (NetEaseKey related)
- Entry 22 (0x8380, len=35) key=0xb0 → "b91b77c926d478406cae3174ce0565db4b" (AgoraKey related)

## Key Getter Functions → .data Pointer Mappings (CORRECTED)
Script had a bug (only caught last LDR+ADD pair). Correct computations:

| Function      | .so offset | Returns to VA          | entry # / note          |
|---------------|-----------|------------------------|-------------------------|
| getDk         | 0x0a4c    | 0xC120, 0xC150, 0xC180 | entries 7, **8**, 9 (one of them) |
| getEk         | 0x2988    | 0xC1dc area            | entry 10 area (needs recheck) |
| getAk         | 0x2a14    | 0xC256 area            | entry 13 area           |
| getAkIv       | 0x2cec    | 0xC2A8, **0xC2D0**     | entry 18 (0x82D0, len=19) |
| getNetEaseKey | 0x2d7c    | **0xC2F0**             | entry 19 (0x82F0, len=35) |
| getAgoraKey   | 0x303c    | **0xC3E0**, 0xC37E     | entries 24, 22          |

**Why:** Script's LDR+ADD detection matched wrong ADD instruction for multi-load blocks.
**How to apply:** Use the literal pool values + all possible ADD PC offsets to find true targets.

getLiteral pool for getDk (at 0xa94-0xa9c): 0xB69A, 0xB6C8, 0xB6F6
- 0xB69A + PC(0xa86) = 0xC120 = entry 7
- 0xB6C8 + PC(0xa88) = 0xC150 = entry 8 ← likely the decrypt key
- 0xB6F6 + PC(0xa8a) = 0xC180 = entry 9

## Cipher Algorithm — Confirmed from DEX
- Found `AES/CBC/PKCS5PADDING` string in `classes3.dex`
- Found `getDk` string in `classes3.dex` (JNI native method ref)
- Found `Ljavax/crypto/spec/IvParameterSpec;` and `SecretKeySpec` in classes3.dex
- Also: `RSA/ECB/PKCS1Padding` in classes.dex (different feature, not `ed`)
- **Why:** `/tmp/dex_out/classes3.dex` extracted from APK; searched with `strings`

## Decryption Attempts — ALL FAILED
Tried all combos of:
- Keys: 713eb1bde..., 4267e81c..., 98ba91ef..., 7c006db4... (as 16-byte hex-decoded)
- Modes: AES-128-CBC, AES-128-ECB, AES-128-GCM, AES-256-CBC (key pairs)
- IVs: zero IV, first-16-bytes-of-ciphertext, combinations
- Also: direct XOR, iv-prefix format (first 16 bytes = IV)
- Payloads: /acc/third/login, /oauth/ticket, /home/tab/room, /version/getInfo

**Failure hypothesis:** Either (a) wrong IV (not zero or ciphertext-prefix), (b) the hex strings in .data are NOT the actual keys but something else, (c) extra processing (zlib decompress after decrypt), or (d) key is entry 7 or 9 (not 8) for getDk.

## Network Flows — 29 Flows in New File
Format: mitmproxy tnetstring (parsed with `re-work/parse_flows.js`)

Key flows:
| # | Endpoint | ed size (bytes) | ed hex[0:8]    |
|---|----------|-----------------|----------------|
| 0 | POST /acc/third/login | 707 | 006ecf02... |
| 1 | POST /oauth/ticket    | 128 | 4d7a17d7... |
| 2-7 | GET various endpoints | 108-144 | **5e43c6a0...** (shared) |
| 8-13 | POST various endpoints | 112-128 | **5e43c6a0...** (shared) |

**Critical observation:** Flows 8,9,10,12,13 ALL return **identical** binary response starting with `VJMQ·R`. Different endpoints → same ciphertext → **same plaintext** (likely `{"code":0,"msg":"ok"}`). This proves the encryption is **deterministic (fixed IV or ECB)**.

The common `ed` value base64: `XkPGoE4Z1r60vdAWhnSK+b7z...`
The common `ed` hex[0:8]: `5e43c6a04e19d6be...`

## VJMQ Response Pattern
The repeated encrypted response (FLOW 8,9,10,12,13) in hex:
Need to extract: `re-work/parse_flows.js` can dump it.
These bytes when decrypted should give `{"code":0,"msg":"ok"}` or `{"code":200,...}`.

## Critical Next Steps (Priority Order)
1. **Dump VJMQ response raw bytes** → use as known-plaintext attack
   - If plaintext = `{"code":0,"msg":"ok"}` (17 bytes → padded to 32) and ciphertext is known, try all 4 keys with all IVs to find match
2. **Check if IV is in entry 18** (0x82D0, len=19, getAkIv): decoded "d3edde..." — could be 16-byte binary IV
3. **Try decoding entries 16+17** (len=9 each, 0x82B0 + 0x82BA) — might combine to 16-byte IV
4. **Disassemble getEk/getAk** more carefully — get correct pointer targets
5. **Search classes3.dex binary** for the class that uses `getDk` + `AES/CBC/PKCS5PADDING` together to find exact key+IV usage pattern

## Known-Plaintext Attack Setup
VJMQ response ciphertext (first 32 bytes, from FLOW 8):
`strings /tmp/dex_out/...` → need to extract raw bytes from flow 8/9/10/12/13 response

**Why this works:** All 5 flows have identical ciphertext. Plaintext is probably a short JSON success response. With known plaintext + known ciphertext, can brute-force IV even if wrong.

## DEX Extraction Commands (for next session)
```bash
cd /tmp && unzip -o /home/runner/workspace/re-work/xapk_extracted/com.ditto.mobile.apk \
  classes.dex classes2.dex classes3.dex classes4.dex classes5.dex classes6.dex -d /tmp/dex_out
strings /tmp/dex_out/classes3.dex | grep -E "getDk|AES/CBC|SecretKey|IvParam"
```

## Server Info
- Host: `www.sayyouditto.com`
- Login endpoint: `POST /acc/third/login` (sends 707-byte encrypted `ed`)
- Auth flow: login → /oauth/ticket → /acc/online → rest of API
- All requests use `ed=<url-encoded-base64>` parameter
- All responses are binary encrypted blobs (NOT JSON)
