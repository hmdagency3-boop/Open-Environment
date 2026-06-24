import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const router = Router();

const SESSION_FILE  = resolve(process.cwd(), "../../re-work/ditto_session.json");
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

// ─── Auth helper ─────────────────────────────────────────────────────────────
function checkAuth(
  headers: Record<string, string | string[] | undefined>,
  body: Record<string, unknown>,
  query: Record<string, unknown>,
): boolean {
  if (!WEBHOOK_SECRET) return false;
  const fromHeader = headers["x-webhook-secret"];
  const fromBody   = body?.secret;
  const fromQuery  = query?.secret;
  const candidate  = fromHeader ?? fromBody ?? fromQuery;
  return typeof candidate === "string" && candidate === WEBHOOK_SECRET;
}

// ─── POST /api/session/update ─────────────────────────────────────────────────
// Called by the Frida hook on NOX/Android whenever a new ticket is captured.
router.post("/session/update", (req, res) => {
  if (!checkAuth(req.headers, req.body ?? {}, req.query)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { ticket, uid, deviceId, access_token } = req.body ?? {};

  // Strict validation — ticket must be a 32-char hex string
  if (
    typeof ticket !== "string" ||
    !/^[0-9a-fA-F]{32}$/.test(ticket)
  ) {
    res.status(400).json({ error: "ticket must be a 32-char hex string" });
    return;
  }

  try {
    let session: Record<string, unknown> = {};
    try {
      session = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
    } catch {
      // No existing session — start fresh
    }

    const now = Date.now();

    session.ticket           = ticket;
    session.ticket_saved_at  = now;

    if (typeof uid      === "string" && uid.trim())      session.uid      = uid.trim();
    if (typeof deviceId === "string" && deviceId.trim()) session.deviceId = deviceId.trim();
    if (typeof access_token === "string" && /^[0-9a-fA-F]{32}$/.test(access_token)) {
      session.access_token           = access_token;
      session.access_token_saved_at  = now;
    }

    writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));

    req.log.info(
      { uid: session.uid, ticket_prefix: ticket.slice(0, 8) + "..." },
      "Session updated via webhook",
    );

    res.json({
      ok:             true,
      uid:            session.uid,
      ticket_prefix:  ticket.slice(0, 8) + "...",
      saved_at:       now,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to write session file");
    res.status(500).json({ error: "Failed to save session" });
  }
});

// ─── GET /api/session/status ──────────────────────────────────────────────────
// Quick check of current session age — useful to poll from NOX or locally.
router.get("/session/status", (req, res) => {
  if (!checkAuth(req.headers, {}, req.query)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const session      = JSON.parse(readFileSync(SESSION_FILE, "utf8")) as Record<string, unknown>;
    const now          = Date.now();
    const savedAt      = Number(session.ticket_saved_at) || 0;
    const ageMin       = savedAt ? Math.round((now - savedAt) / 60000) : null;
    const validForMin  = ageMin !== null ? 60 - ageMin : null;

    res.json({
      uid:               session.uid,
      ticket_prefix:     typeof session.ticket === "string"
        ? session.ticket.slice(0, 8) + "..."
        : null,
      ticket_age_min:    ageMin,
      ticket_valid_for_min: validForMin,
      ticket_expired:    validForMin !== null && validForMin <= 0,
    });
  } catch {
    res.status(404).json({ error: "No session found" });
  }
});

export default router;
