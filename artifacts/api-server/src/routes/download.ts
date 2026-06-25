import { Router } from "express";
import { readFileSync } from "fs";
import { resolve } from "path";

const router = Router();

function serveScript(filename: string) {
  return (_req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]) => {
    try {
      const file = readFileSync(resolve(process.cwd(), `../../re-work/${filename}`), "utf8");
      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(file);
    } catch {
      res.status(500).send("File not found");
    }
  };
}

router.get("/local_proxy.js",  serveScript("local_proxy.js"));
router.get("/ditto_worker.js", serveScript("ditto_worker.js"));
router.get("/ditto_session.json", (_req, res) => {
  try {
    const file = readFileSync(resolve(process.cwd(), "../../re-work/ditto_session.json"), "utf8");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", 'attachment; filename="ditto_session.json"');
    res.send(file);
  } catch {
    res.status(500).send("File not found");
  }
});

export default router;
