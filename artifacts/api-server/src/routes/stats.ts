import { Router, type IRouter } from "express";
import { sql, isNull } from "drizzle-orm";
import { db, wordsTable, settingsTable, wordEventsTable } from "@workspace/db";
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

  // All counters filtered to non-deleted words only
  const [totals] = await db
    .select({
      totalWords: sql<number>`count(*)::int`,
      // Mastered = completed at least 4 successful SRS cycles (reviewed 4+ times correctly)
      masteredWords: sql<number>`count(*) filter (where ${wordsTable.reviewInterval} >= 4)::int`,
      // Due for review = word is in the SRS queue AND its next-session number has arrived
      dueForReview: sql<number>`count(*) filter (where ${wordsTable.nextReviewSession} is not null and ${wordsTable.nextReviewSession} <= ${totalSessions})::int`,
    })
    .from(wordsTable)
    .where(isNull(wordsTable.deletedAt));  // ← exclude soft-deleted words

  // Accuracy from word_events: correct answers / (correct + wrong answers)
  // This is real attempt-based accuracy, not a hint-distorted ratio.
  const [accuracy] = await db
    .select({
      correct: sql<number>`count(*) filter (where ${wordEventsTable.eventType} in ('correct','review_correct'))::int`,
      wrong:   sql<number>`count(*) filter (where ${wordEventsTable.eventType} in ('wrong','review_wrong'))::int`,
    })
    .from(wordEventsTable);

  const totalAttempts = (accuracy?.correct ?? 0) + (accuracy?.wrong ?? 0);
  const accuracyPercent = totalAttempts > 0
    ? Math.round(((accuracy?.correct ?? 0) / totalAttempts) * 100)
    : 0;

  // Words answered correctly for the first time today
  const [practicedToday] = await db
    .select({ count: sql<number>`count(distinct ${wordEventsTable.wordId})::int` })
    .from(wordEventsTable)
    .where(sql`${wordEventsTable.createdAt} >= ${todayStart} and ${wordEventsTable.eventType} in ('correct', 'review_correct')`);
  const wordsLearnedToday = practicedToday?.count ?? 0;

  res.json(
    GetStatsResponse.parse({
      totalWords:       totals?.totalWords       ?? 0,
      masteredWords:    totals?.masteredWords     ?? 0,
      dueForReview:     totals?.dueForReview      ?? 0,
      totalCorrect:     accuracy?.correct         ?? 0,
      totalHints:       accuracy?.wrong           ?? 0,   // field reused for "wrong" count display
      accuracyPercent,
      wordsLearnedToday,
    }),
  );
});

export default router;
