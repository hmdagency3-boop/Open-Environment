/**
 * Ditto API routes — proxies to www.sayyouditto.com using stored session
 */
import { Router } from "express";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { request as httpsRequest } from "https";
import { gunzipSync } from "zlib";
import { readFileSync } from "fs";
import { resolve } from "path";

const router = Router();

const SESSION_FILE = resolve(process.cwd(), "../../re-work/ditto_session.json");
const KEY = Buffer.from("a38e5f04f39b11ed", "ascii");
const IV  = Buffer.from("884e00163e02b26e", "ascii");

// ── Crypto ────────────────────────────────────────────────────────────────────
function encrypt(plain: string): string {
  const c = createCipheriv("aes-128-cbc", KEY, IV);
  return Buffer.concat([c.update(Buffer.from(plain, "utf8")), c.final()]).toString("base64");
}

function decrypt(b64: string): string {
  let s = b64.trim().replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const d = createDecipheriv("aes-128-cbc", KEY, IV);
  return Buffer.concat([d.update(Buffer.from(s, "base64")), d.final()]).toString("utf8");
}

// ── Session ───────────────────────────────────────────────────────────────────
function loadSession(): Record<string, string> {
  try { return JSON.parse(readFileSync(SESSION_FILE, "utf8")); }
  catch { return {}; }
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function makeHeaders(): Record<string, string> {
  return {
    simulator: "physical", language: "1", appcode: "1030400",
    appversion: "1.3.4.0", os: "android", app: "ditto",
    model: "M1908C3JGG", channel: "google_play",
    systemlanguage: "en", osversion: "13",
    t: Date.now().toString(),
    sn: randomBytes(4).toString("hex").slice(0, 7),
    "accept-encoding": "gzip", "user-agent": "okhttp/4.12.0",
  };
}

function dittoRaw(path: string, body: string | null = null, method = "GET"): Promise<string> {
  return new Promise((resolve, reject) => {
    const extraH: Record<string, string> = body
      ? { "content-type": "application/x-www-form-urlencoded", "content-length": String(Buffer.byteLength(body)) }
      : {};
    const req = httpsRequest(
      { hostname: "www.sayyouditto.com", port: 443, path, method, headers: { ...makeHeaders(), ...extraH } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          let raw = Buffer.concat(chunks);
          if (res.headers["content-encoding"] === "gzip") {
            try { raw = gunzipSync(raw); } catch { /* not gzip */ }
          }
          resolve(raw.toString("utf8"));
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(new Error("Timeout")); });
    if (body) req.write(body);
    req.end();
  });
}

async function dittoCall(endpoint: string, params: Record<string, string>, method = "GET"): Promise<unknown> {
  const session = loadSession();
  const merged = { ticket: session.ticket ?? "", uid: session.uid ?? "", deviceId: session.deviceId ?? "", simCountry: "eg", ...params };
  const plain = new URLSearchParams(merged).toString();
  const enc = encrypt(plain);

  let reqPath = endpoint;
  let body: string | null = null;
  if (method === "GET") {
    reqPath = endpoint + "?ed=" + encodeURIComponent(enc);
  } else {
    body = "ed=" + encodeURIComponent(enc);
  }

  const raw = await dittoRaw(reqPath, body, method);
  const json = JSON.parse(raw) as Record<string, unknown>;
  if (typeof json.ed === "string") return JSON.parse(decrypt(json.ed));
  return json;
}

// ── Job queue helpers (for worker-routed calls) ───────────────────────────────
let lastWorkerPollAt = 0;

export function markWorkerPoll() {
  lastWorkerPollAt = Date.now();
}

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

interface JobEntry {
  jobId: string;
  endpoint: string;
  params: Record<string, string>;
  created: number;
  result?: unknown;
  done: boolean;
}

// Shared job store — same instance used by jobs.ts router
// We create jobs here and wait for results via long-poll
declare const globalThis: { _dittoJobs?: Map<string, JobEntry>; _dittoWaiters?: Map<string, ((r: unknown) => void)[]> };
if (!globalThis._dittoJobs) globalThis._dittoJobs = new Map();
if (!globalThis._dittoWaiters) globalThis._dittoWaiters = new Map();

function makeJobId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Queue a job for the worker and wait up to `timeoutMs` for the result.
 * Returns { result, timedOut: false } or { result: null, timedOut: true }.
 */
function queueWorkerJob(
  endpoint: string,
  params: Record<string, string>,
  timeoutMs = 25000,
): Promise<{ result: unknown; timedOut: boolean }> {
  const jobId = makeJobId();
  const job: JobEntry = { jobId, endpoint, params, created: Date.now(), done: false };
  globalThis._dittoJobs!.set(jobId, job);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      globalThis._dittoWaiters!.delete(jobId);
      resolve({ result: null, timedOut: true });
    }, timeoutMs);

    const cb = (result: unknown) => {
      clearTimeout(timer);
      resolve({ result, timedOut: false });
    };

    const list = globalThis._dittoWaiters!.get(jobId) ?? [];
    list.push(cb);
    globalThis._dittoWaiters!.set(jobId, list);
  });
}

// ── GET /api/ditto/session ────────────────────────────────────────────────────
router.get("/session", (_req, res) => {
  try {
    const session = JSON.parse(readFileSync(SESSION_FILE, "utf8")) as Record<string, unknown>;
    const now = Date.now();
    const savedAt = Number(session.ticket_saved_at) || 0;
    const ageMin = savedAt ? Math.round((now - savedAt) / 60000) : null;
    const validForMin = ageMin !== null ? 60 - ageMin : null;
    res.json({
      uid: session.uid ?? null,
      ticket_prefix: typeof session.ticket === "string" ? session.ticket.slice(0, 8) + "..." : null,
      ticket_age_min: ageMin,
      ticket_valid_for_min: validForMin,
      ticket_expired: validForMin !== null && validForMin <= 0,
    });
  } catch {
    res.json({ uid: null, ticket_prefix: null, ticket_age_min: null, ticket_valid_for_min: null, ticket_expired: true });
  }
});

// ── GET /api/ditto/balance ────────────────────────────────────────────────────
router.get("/balance", async (_req, res) => {
  try {
    const result = await dittoCall("/purse/query", {}) as Record<string, unknown>;
    if (result && typeof result === "object" && (result as Record<string, unknown>).code === 200) {
      const data = (result as Record<string, unknown>).data as Record<string, unknown>;
      res.json({ ok: true, ...data });
    } else {
      res.json({ ok: false, error: result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ── GET /api/ditto/user/:uid ──────────────────────────────────────────────────
router.get("/user/:uid", async (req, res) => {
  const { uid } = req.params;
  if (!uid || !/^\d+$/.test(uid)) {
    res.status(400).json({ error: "uid must be numeric" });
    return;
  }

  try {
    const giftsResult = await dittoCall("/giftwall/getUserHistoryReceives", { tgUid: uid }) as Record<string, unknown>;

    let topGifts: Record<string, unknown>[] = [];
    let totalNum: number | null = null;
    let totalTypes: number | null = null;

    if (giftsResult && (giftsResult as Record<string, unknown>).code === 200) {
      const data = (giftsResult as Record<string, unknown>).data as Record<string, unknown>;
      const rawList = (data?.topList as Record<string, unknown>[]) ?? [];
      topGifts = rawList.map((g) => ({
        giftId:   g.giftId ?? null,
        giftName: g.giftName ?? null,
        num:      g.num ?? null,
        icon:     g.icon ?? null,
      }));
      totalNum = (data?.totalNum as number) ?? null;
      totalTypes = (data?.totalTypeNum as number) ?? null;
    }

    res.json({
      uid,
      totalGiftsNum: totalNum,
      totalGiftTypes: totalTypes,
      topGifts,
      profile: null,
      workerUsed: false,
      source: "direct",
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── GET /api/ditto/user/:uid/profile ─────────────────────────────────────────
// Routes through the Egyptian worker (geo-locked endpoint)
router.get("/user/:uid/profile", async (req, res) => {
  const { uid } = req.params;
  if (!uid || !/^\d+$/.test(uid)) {
    res.status(400).json({ ok: false, uid, workerUsed: false, workerNeeded: true, error: "uid must be numeric" });
    return;
  }

  const workerConnected = lastWorkerPollAt && (Date.now() - lastWorkerPollAt) < 10000;

  if (!workerConnected) {
    // Try direct anyway (may work with fresh ticket)
    try {
      const result = await dittoCall("/user/v3/get", { queryUid: uid }) as Record<string, unknown>;
      if (result && (result as Record<string, unknown>).code === 200) {
        const d = (result as Record<string, unknown>).data as Record<string, unknown>;
        return res.json(buildProfileResponse(uid, d, false, false));
      }
    } catch { /* fall through */ }

    return res.json({
      ok: false, uid, nickname: null, avatar: null, signature: null,
      erbanNo: null, fansNum: null, followNum: null, level: null,
      diamond: null, online: null, workerUsed: false, workerNeeded: true, raw: null,
    });
  }

  // Queue a job for the worker
  const { result, timedOut } = await queueWorkerJob("/user/v3/get", { queryUid: uid }, 25000);

  if (timedOut || !result) {
    return res.json({
      ok: false, uid, nickname: null, avatar: null, signature: null,
      erbanNo: null, fansNum: null, followNum: null, level: null,
      diamond: null, online: null, workerUsed: true, workerNeeded: false,
      raw: null, error: timedOut ? "Worker timeout" : "No result",
    });
  }

  const r = result as Record<string, unknown>;
  if (r.code === 200) {
    const d = r.data as Record<string, unknown>;
    return res.json(buildProfileResponse(uid, d, true, false));
  }

  return res.json({
    ok: false, uid, nickname: null, avatar: null, signature: null,
    erbanNo: null, fansNum: null, followNum: null, level: null,
    diamond: null, online: null, workerUsed: true, workerNeeded: false,
    raw: r, error: `API code ${r.code}`,
  });
});

function buildProfileResponse(uid: string, d: Record<string, unknown>, workerUsed: boolean, workerNeeded: boolean) {
  return {
    ok: true,
    uid,
    nickname:  d.nickName  ?? d.nickname  ?? null,
    avatar:    d.avatar    ?? d.headImg   ?? null,
    signature: d.signature ?? d.sign      ?? null,
    erbanNo:   d.erbanNo   ?? d.erbano    ?? null,
    fansNum:   d.fansNum   ?? d.fans      ?? null,
    followNum: d.followNum ?? d.follow    ?? null,
    level:     d.level     ?? d.lv        ?? null,
    diamond:   d.diamond   ?? d.diamondNum ?? null,
    online:    d.online    ?? null,
    workerUsed,
    workerNeeded,
    raw: d,
  };
}

// ── GET /api/ditto/search ─────────────────────────────────────────────────────
// Search users by nickname or erbanNo via worker
router.get("/search", async (req, res) => {
  const q = (req.query.q as string ?? "").trim();
  if (!q) {
    res.status(400).json({ ok: false, users: [], workerUsed: false, workerNeeded: false, error: "q required" });
    return;
  }

  const workerConnected = lastWorkerPollAt && (Date.now() - lastWorkerPollAt) < 10000;

  if (!workerConnected) {
    // Try direct call
    try {
      const result = await dittoCall("/user/search", { keyword: q }) as Record<string, unknown>;
      if (result && (result as Record<string, unknown>).code === 200) {
        const list = extractSearchList(result);
        return res.json({ ok: true, users: list, workerUsed: false, workerNeeded: false });
      }
    } catch { /* fall through */ }

    return res.json({ ok: false, users: [], workerUsed: false, workerNeeded: true });
  }

  const { result, timedOut } = await queueWorkerJob("/user/search", { keyword: q }, 25000);

  if (timedOut || !result) {
    return res.json({
      ok: false, users: [], workerUsed: true, workerNeeded: false,
      error: timedOut ? "Worker timeout" : "No result",
    });
  }

  const r = result as Record<string, unknown>;
  if (r.code === 200) {
    return res.json({ ok: true, users: extractSearchList(r), workerUsed: true, workerNeeded: false });
  }

  return res.json({ ok: false, users: [], workerUsed: true, workerNeeded: false, error: `API code ${r.code}` });
});

function extractSearchList(result: Record<string, unknown>): Record<string, unknown>[] {
  const data = result.data as Record<string, unknown> ?? {};
  const raw = (data.list ?? data.userList ?? data.users ?? []) as Record<string, unknown>[];
  return raw.map((u) => ({
    uid:      u.uid ?? null,
    nickname: u.nickName ?? u.nickname ?? null,
    avatar:   u.avatar ?? u.headImg ?? null,
    erbanNo:  u.erbanNo ?? null,
    fansNum:  u.fansNum ?? null,
    level:    u.level ?? u.lv ?? null,
  }));
}

// ── GET /api/ditto/rooms ──────────────────────────────────────────────────────
router.get("/rooms", async (req, res) => {
  const tab = (req.query.tab as string) ?? "POPULAR";
  const pageNum = (req.query.pageNum as string) ?? "1";
  const pageSize = (req.query.pageSize as string) ?? "20";

  try {
    const result = await dittoCall("/home/tab/room", { tab, pageNum, pageSize }) as Record<string, unknown>;
    if (result && (result as Record<string, unknown>).code === 200) {
      const data = (result as Record<string, unknown>).data as Record<string, unknown>;
      const list = (data?.listRoom as Record<string, unknown>[])
        ?? (data?.list as Record<string, unknown>[])
        ?? [];
      const rooms = list.map((r) => ({
        roomId:    r.roomId ?? r.id ?? null,
        roomName:  r.roomName ?? r.name ?? null,
        cover:     r.cover ?? r.coverImage ?? null,
        onlineNum: r.onlineNum ?? r.online ?? null,
        uid:       r.uid ?? null,
      }));
      res.json({ ok: true, rooms, total: (data?.total ?? list.length) });
    } else {
      res.json({ ok: false, rooms: [], total: null, error: result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, rooms: [], error: String(e) });
  }
});

// ── GET /api/ditto/explore ────────────────────────────────────────────────────
router.get("/explore", async (_req, res) => {
  try {
    const result = await dittoCall("/explore/info", { pageNo: "1", pageSize: "20" }) as Record<string, unknown>;
    if (result && (result as Record<string, unknown>).code === 200) {
      res.json({ ok: true, raw: (result as Record<string, unknown>).data });
    } else {
      res.json({ ok: false, raw: result });
    }
  } catch (e) {
    res.status(500).json({ ok: false, raw: {}, error: String(e) });
  }
});

// ── GET /api/ditto/worker/status ──────────────────────────────────────────────
router.get("/worker/status", (_req, res) => {
  const pendingJobs = [...(globalThis._dittoJobs?.values() ?? [])].filter(j => !j.done).length;
  const lastPollAgo = lastWorkerPollAt ? Math.round((Date.now() - lastWorkerPollAt) / 1000) : null;
  const connected = lastPollAgo !== null && lastPollAgo < 10;
  res.json({ connected, pendingJobs, lastPollAgo });
});

export default router;
