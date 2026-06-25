import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import downloadRouter from "./download";
import jobsRouter from "./jobs";
import dittoRouter from "./ditto";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use("/download", downloadRouter);
router.use("/jobs", jobsRouter);
router.use("/ditto", dittoRouter);

export default router;
