/**
 * Job Queue — lets the Windows machine poll for API jobs and post results back.
 *
 * POST /api/jobs/create   { secret, endpoint, params }  → { jobId }
 * GET  /api/jobs/pending  ?secret=...                   → { job } or { job: null }
 * POST /api/jobs/result   { secret, jobId, result }     → { ok }
 * GET  /api/jobs/result/:jobId ?secret=...              → { result } (long-poll 20s)
 */
import { Router } from "express";

const router = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

interface Job {
  jobId:    string;
  endpoint: string;
  params:   Record<string, string>;
  created:  number;
  result?:  unknown;
  done:     boolean;
}

const jobs  = new Map<string, Job>();
// Waiters for long-poll on result
const waiters = new Map<string, ((result: unknown) => void)[]>();

function auth(secret: unknown): boolean {
  return typeof secret === "string" && secret === WEBHOOK_SECRET && WEBHOOK_SECRET !== "";
}
function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ── POST /api/jobs/create ─────────────────────────────────────────────────────
router.post("/create", (req, res) => {
  if (!auth(req.headers["x-webhook-secret"] ?? req.body?.secret)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const { endpoint, params = {} } = req.body ?? {};
  if (typeof endpoint !== "string") {
    res.status(400).json({ error: "endpoint required" }); return;
  }
  const jobId = makeId();
  jobs.set(jobId, { jobId, endpoint, params, created: Date.now(), done: false });
  res.json({ jobId });
});

// ── GET /api/jobs/pending ─────────────────────────────────────────────────────
router.get("/pending", (req, res) => {
  if (!auth(req.headers["x-webhook-secret"] ?? req.query.secret)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  // Return oldest undone job
  for (const [, job] of jobs) {
    if (!job.done) { res.json({ job }); return; }
  }
  res.json({ job: null });
});

// ── POST /api/jobs/result ─────────────────────────────────────────────────────
router.post("/result", (req, res) => {
  if (!auth(req.headers["x-webhook-secret"] ?? req.body?.secret)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const { jobId, result } = req.body ?? {};
  const job = jobs.get(jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  job.result = result;
  job.done   = true;
  // Wake any long-pollers
  (waiters.get(jobId) ?? []).forEach(cb => cb(result));
  waiters.delete(jobId);
  res.json({ ok: true });
});

// ── GET /api/jobs/result/:jobId  (long-poll up to 25s) ───────────────────────
router.get("/result/:jobId", (req, res) => {
  if (!auth(req.headers["x-webhook-secret"] ?? req.query.secret)) {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  const job = jobs.get(req.params.jobId);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.done) { res.json({ done: true, result: job.result }); return; }

  // Long-poll: wait up to 25s for the result
  const timer = setTimeout(() => {
    const list = waiters.get(job.jobId) ?? [];
    const idx  = list.indexOf(respond);
    if (idx !== -1) list.splice(idx, 1);
    res.json({ done: false });
  }, 25_000);

  function respond(result: unknown) {
    clearTimeout(timer);
    res.json({ done: true, result });
  }

  const list = waiters.get(job.jobId) ?? [];
  list.push(respond);
  waiters.set(job.jobId, list);

  // Clean up if client disconnects
  req.on("close", () => {
    clearTimeout(timer);
    const l = waiters.get(job.jobId) ?? [];
    const i = l.indexOf(respond);
    if (i !== -1) l.splice(i, 1);
  });
});

export default router;
