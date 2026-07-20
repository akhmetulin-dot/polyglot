import { Router, type IRouter } from "express";
import { sql, isNotNull } from "drizzle-orm";
import { db, wordsTable, settingsTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get current session count for due-for-review calculation
  const [settingsRow] = await db
    .select({ totalSessions: settingsTable.totalSessions })
    .from(settingsTable);
  const totalSessions = settingsRow?.totalSessions ?? 0;

  const [totals] = await db
    .select({
      totalWords: sql<number>`count(*)::int`,
      // Mastered = completed at least 4 successful review cycles
      masteredWords: sql<number>`count(*) filter (where ${wordsTable.reviewInterval} >= 4)::int`,
      // Due = in SRS queue and session number has been reached
      dueForReview: sql<number>`count(*) filter (where ${wordsTable.nextReviewSession} is not null and ${wordsTable.nextReviewSession} <= ${totalSessions})::int`,
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
