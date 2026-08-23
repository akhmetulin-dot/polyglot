import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import mindmapsRouter from "./mindmaps.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mindmapsRouter);

export default router;
