import { Router, type IRouter } from "express";
import healthRouter from "./health";
import wordsRouter from "./words";
import trainingRouter from "./training";
import settingsRouter from "./settings";
import statsRouter from "./stats";
import tagsRouter from "./tags";
import mindmapsRouter from "./mindmaps";

const router: IRouter = Router();

router.use(healthRouter);
router.use(wordsRouter);
router.use(trainingRouter);
router.use(settingsRouter);
router.use(statsRouter);
router.use(tagsRouter);
router.use(mindmapsRouter);

export default router;
