import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import downloadRouter from "./download";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use("/download", downloadRouter);

export default router;
