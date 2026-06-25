import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import downloadRouter from "./download";
import jobsRouter from "./jobs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use("/download", downloadRouter);
router.use("/jobs", jobsRouter);

export default router;
