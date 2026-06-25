import { Router } from "express";
import { readFileSync } from "fs";
import { resolve } from "path";

const router = Router();

// GET /download/local_proxy.js — serves the proxy script for Windows setup
router.get("/local_proxy.js", (_req, res) => {
  try {
    const file = readFileSync(resolve(process.cwd(), "../../re-work/local_proxy.js"), "utf8");
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Content-Disposition", 'attachment; filename="local_proxy.js"');
    res.send(file);
  } catch (err) {
    res.status(500).send("File not found");
  }
});

export default router;
