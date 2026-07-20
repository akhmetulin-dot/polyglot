import { Router, type IRouter } from "express";
import { sql, lte, gte } from "drizzle-orm";
import { db, wordsTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [totals] = await db
    .select({
      totalWords: sql<number>`count(*)::int`,
      masteredWords: sql<number>`count(*) filter (where ${wordsTable.reviewInterval} >= 30)::int`,
      dueForReview: sql<number>`count(*) filter (where ${wordsTable.nextReviewAt} is not null and ${wordsTable.nextReviewAt} <= ${now})::int`,
      totalCorrect: sql<number>`coalesce(sum(${wordsTable.correctCount}), 0)::int`,
      totalHints: sql<number>`coalesce(sum(${wordsTable.hintCount}), 0)::int`,
      wordsLearnedToday: sql<number>`count(*) filter (where ${wordsTable.createdAt} >= ${todayStart})::int`,
    })
    .from(wordsTable);

  const totalAttempts = (totals.totalCorrect ?? 0) + (totals.totalHints ?? 0);
  const accuracyPercent = totalAttempts > 0
    ? Math.round(((totals.totalCorrect ?? 0) / totalAttempts) * 100)
    : 0;

  res.json(
    GetStatsResponse.parse({
      totalWords: totals.totalWords ?? 0,
      masteredWords: totals.masteredWords ?? 0,
      dueForReview: totals.dueForReview ?? 0,
      totalCorrect: totals.totalCorrect ?? 0,
      totalHints: totals.totalHints ?? 0,
      accuracyPercent,
      wordsLearnedToday: totals.wordsLearnedToday ?? 0,
    }),
  );
});

export default router;
