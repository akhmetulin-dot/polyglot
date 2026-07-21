import { Router, type IRouter } from "express";
import { eq, isNull, isNotNull, and, lte, asc, desc } from "drizzle-orm";
import { db, wordsTable, settingsTable, wordEventsTable } from "@workspace/db";
import {
  GetTrainingSessionQueryParams,
  GetTrainingSessionResponse,
  SubmitAnswerBody,
  SubmitAnswerResponse,
  RequestHintBody,
  RequestHintResponse,
  GetDueReviewsQueryParams,
  GetDueReviewsResponse,
  CompleteSessionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function isCorrect(answer: string, correct: string | null | undefined): boolean {
  if (!correct) return answer.trim() === "";
  return normalize(answer) === normalize(correct);
}

async function getSettings() {
  const [settings] = await db.select().from(settingsTable);
  if (!settings) {
    return {
      sessionSize: 20,
      reviewIntervals: [3, 5, 9, 13],
      errorRepeatAfter: 5,
      totalSessions: 0,
      graduationThreshold: 7,
      settingsId: null as number | null,
    };
  }
  return {
    sessionSize: settings.sessionSize,
    errorRepeatAfter: settings.errorRepeatAfter,
    reviewIntervals: settings.reviewIntervals.split(",").map(Number).filter(Boolean),
    totalSessions: settings.totalSessions,
    graduationThreshold: settings.graduationThreshold,
    settingsId: settings.id,
  };
}

async function logEvent(
  wordId: number,
  eventType: string,
  sessionNumber: number,
): Promise<void> {
  await db.insert(wordEventsTable).values({ wordId, eventType, sessionNumber });
}

// Get words for a new training session (new words only — nextReviewAt IS NULL, not graduated)
router.get("/training/session", async (req, res): Promise<void> => {
  const parsed = GetTrainingSessionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const count = parsed.data.count ?? settings.sessionSize;

  const words = await db
    .select()
    .from(wordsTable)
    .where(and(isNull(wordsTable.nextReviewAt), isNull(wordsTable.deletedAt)))
    // Priority words (wrong-answer returns) come first, then by frequency rank
    .orderBy(desc(wordsTable.priority), asc(wordsTable.frequencyRank), asc(wordsTable.id))
    .limit(count);

  const sessionWords = words.map((w) => ({
    wordId: w.id,
    russian: w.russian,
    mnemonic: w.mnemonic,
    frequencyRank: w.frequencyRank,
    correctCount: w.correctCount,
    hintCount: w.hintCount,
  }));

  res.json(
    GetTrainingSessionResponse.parse({
      sessionId: `session-${Date.now()}`,
      words: sessionWords,
    }),
  );
});

// Submit an answer — handles both new-word training and SRS review
router.post("/training/answer", async (req, res): Promise<void> => {
  const parsed = SubmitAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { wordId, polish, german, english } = parsed.data;

  const [word] = await db.select().from(wordsTable).where(eq(wordsTable.id, wordId));
  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }

  const polishCorrect = isCorrect(polish, word.polish);
  const germanCorrect = isCorrect(german, word.german);
  const englishCorrect = isCorrect(english, word.english);
  const allCorrect = polishCorrect && germanCorrect && englishCorrect;

  // isInReview = word has been through Прописи+Тест at least once (has SRS data)
  const isInReview = word.nextReviewSession !== null;
  const settings = await getSettings();
  const intervals = settings.reviewIntervals;
  const currentSession = settings.totalSessions;

  if (allCorrect) {
    const nextIntervalIndex = Math.min(word.reviewInterval, intervals.length - 1);
    const nextInterval = intervals[nextIntervalIndex] ?? intervals[intervals.length - 1] ?? 3;
    const nextReviewSession = currentSession + nextInterval;
    const newConsecutiveCorrect = (word.consecutiveCorrect ?? 0) + 1;
    const threshold = settings.graduationThreshold;
    const isGraduating = isInReview && newConsecutiveCorrect >= threshold;

    await db
      .update(wordsTable)
      .set({
        correctCount: word.correctCount + 1,
        reviewInterval: word.reviewInterval + 1,
        priority: 0,
        consecutiveCorrect: isGraduating ? newConsecutiveCorrect : newConsecutiveCorrect,
        graduatedAt: isGraduating ? new Date() : word.graduatedAt,
        nextReviewAt: new Date(),
        // Graduated words get a very long next session so they don't appear in due query
        nextReviewSession: isGraduating ? currentSession + 9999 : nextReviewSession,
      })
      .where(eq(wordsTable.id, wordId));

    await logEvent(wordId, isGraduating ? "graduated" : isInReview ? "review_correct" : "correct", currentSession);
  } else {
    if (isInReview) {
      // Wrong in Повторение → stay in SRS (don't reset to new/Прописи), but reset interval
      // Word will reappear in next session's review queue
      await db
        .update(wordsTable)
        .set({
          nextReviewAt: new Date(),           // keeps it in SRS — NOT null (no Прописи)
          nextReviewSession: currentSession + 1, // due in next session
          reviewInterval: 0,                  // restart interval progression
          consecutiveCorrect: 0,              // reset streak
          priority: 1,                        // surface first
        })
        .where(eq(wordsTable.id, wordId));
      await logEvent(wordId, "review_wrong", currentSession);
    } else {
      // Wrong in Тест (first time after Прописи) → stays in new queue, surfaces first next time
      await db
        .update(wordsTable)
        .set({ priority: 1 })
        .where(eq(wordsTable.id, wordId));
      await logEvent(wordId, "wrong", currentSession);
    }
  }

  const [updated] = await db.select().from(wordsTable).where(eq(wordsTable.id, wordId));

  res.json(
    SubmitAnswerResponse.parse({
      wordId,
      polishCorrect,
      germanCorrect,
      englishCorrect,
      allCorrect,
      word: updated,
    }),
  );
});

// Request a hint during training
router.post("/training/hint", async (req, res): Promise<void> => {
  const parsed = RequestHintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { wordId } = parsed.data;
  const [word] = await db.select().from(wordsTable).where(eq(wordsTable.id, wordId));
  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }

  await db
    .update(wordsTable)
    .set({ hintCount: word.hintCount + 1 })
    .where(eq(wordsTable.id, wordId));

  const settings = await getSettings();
  await logEvent(wordId, "hint", settings.totalSessions);

  res.json(
    RequestHintResponse.parse({
      wordId,
      mnemonic: word.mnemonic,
      polish: word.polish,
      german: word.german,
      english: word.english,
      hintCount: word.hintCount + 1,
    }),
  );
});

// Complete a session — increments the global session counter
router.post("/training/complete", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  const newTotal = settings.totalSessions + 1;

  if (settings.settingsId !== null) {
    await db
      .update(settingsTable)
      .set({ totalSessions: newTotal })
      .where(eq(settingsTable.id, settings.settingsId));
  } else {
    await db.insert(settingsTable).values({ totalSessions: newTotal });
  }

  res.json(CompleteSessionResponse.parse({ totalSessions: newTotal }));
});

// Get words due for SRS review — excludes graduated words
router.get("/review/due", async (req, res): Promise<void> => {
  const parsed = GetDueReviewsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const count = parsed.data.count ?? settings.sessionSize;
  const currentSession = settings.totalSessions;

  const words = await db
    .select()
    .from(wordsTable)
    .where(
      and(
        isNotNull(wordsTable.nextReviewSession),
        lte(wordsTable.nextReviewSession, currentSession),
        isNull(wordsTable.deletedAt),
        isNull(wordsTable.graduatedAt), // Exclude fully learned words
      ),
    )
    .orderBy(asc(wordsTable.nextReviewSession))
    .limit(count);

  const reviewWords = words.map((w) => ({
    wordId: w.id,
    russian: w.russian,
    mnemonic: w.mnemonic,
    frequencyRank: w.frequencyRank,
    correctCount: w.correctCount,
    hintCount: w.hintCount,
  }));

  res.json(GetDueReviewsResponse.parse({ words: reviewWords, total: reviewWords.length }));
});

export default router;
