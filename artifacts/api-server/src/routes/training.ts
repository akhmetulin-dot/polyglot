import { Router, type IRouter } from "express";
import { eq, isNull, or, lte, sql, asc } from "drizzle-orm";
import { db, wordsTable, settingsTable } from "@workspace/db";
import {
  GetTrainingSessionQueryParams,
  GetTrainingSessionResponse,
  SubmitAnswerBody,
  SubmitAnswerResponse,
  RequestHintBody,
  RequestHintResponse,
  GetDueReviewsQueryParams,
  GetDueReviewsResponse,
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
      reviewIntervals: [1, 3, 7, 14, 30, 90],
      errorRepeatAfter: 5,
    };
  }
  return {
    sessionSize: settings.sessionSize,
    errorRepeatAfter: settings.errorRepeatAfter,
    reviewIntervals: settings.reviewIntervals.split(",").map(Number).filter(Boolean),
  };
}

router.get("/training/session", async (req, res): Promise<void> => {
  const parsed = GetTrainingSessionQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const count = parsed.data.count ?? settings.sessionSize;

  // Get words that haven't been mastered yet (nextReviewAt is null = new words)
  // Prioritize by frequency rank
  const words = await db
    .select()
    .from(wordsTable)
    .where(isNull(wordsTable.nextReviewAt))
    .orderBy(asc(wordsTable.frequencyRank), asc(wordsTable.id))
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

  // Update stats
  if (allCorrect) {
    // Schedule for spaced repetition
    const settings = await getSettings();
    const intervals = settings.reviewIntervals;
    const nextIntervalIndex = Math.min(word.reviewInterval, intervals.length - 1);
    const nextInterval = intervals[nextIntervalIndex] ?? 1;
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + nextInterval);

    await db
      .update(wordsTable)
      .set({
        correctCount: word.correctCount + 1,
        reviewInterval: nextIntervalIndex + 1,
        nextReviewAt,
      })
      .where(eq(wordsTable.id, wordId));
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

router.get("/review/due", async (req, res): Promise<void> => {
  const parsed = GetDueReviewsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const settings = await getSettings();
  const count = parsed.data.count ?? settings.reviewIntervals.length;
  const now = new Date();

  const words = await db
    .select()
    .from(wordsTable)
    .where(lte(wordsTable.nextReviewAt, now))
    .orderBy(asc(wordsTable.nextReviewAt))
    .limit(count);

  const total = words.length;

  const reviewWords = words.map((w) => ({
    wordId: w.id,
    russian: w.russian,
    mnemonic: w.mnemonic,
    frequencyRank: w.frequencyRank,
    correctCount: w.correctCount,
    hintCount: w.hintCount,
  }));

  res.json(GetDueReviewsResponse.parse({ words: reviewWords, total }));
});

export default router;
