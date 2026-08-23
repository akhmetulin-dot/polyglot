import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import wordsRouter from "./words.js";
import trainingRouter from "./training.js";
import settingsRouter from "./settings.js";
import statsRouter from "./stats.js";
import tagsRouter from "./tags.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(wordsRouter);
router.use(trainingRouter);
router.use(settingsRouter);
router.use(statsRouter);
router.use(tagsRouter);

export default router;
