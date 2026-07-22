// @ts-nocheck
import { Router, type IRouter } from "express";
import { eq, ilike, or, and, asc, desc, isNull, isNotNull, sql } from "drizzle-orm";
import { db, wordsTable, wordEventsTable, settingsTable } from "@workspace/db";
import {
  ListWordsQueryParams,
  ListWordsResponse,
  CreateWordBody,
  CreateWordResponse,
  GetWordParams,
  GetWordResponse,
  UpdateWordParams,
  UpdateWordBody,
  UpdateWordResponse,
  DeleteWordParams,
  BulkImportWordsBody,
  BulkImportWordsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ─── Word list (active only) ─────────────────────────────────────────────────
router.get("/words", async (req, res): Promise<void> => {
  const parsed = ListWordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, sortBy, limit = 200, offset = 0 } = parsed.data;

  // Build base filter
  const baseWhere = isNull(wordsTable.deletedAt);
  const searchWhere = search
    ? or(
        ilike(wordsTable.russian, `%${search}%`),
        ilike(wordsTable.polish, `%${search}%`),
        ilike(wordsTable.german, `%${search}%`),
        ilike(wordsTable.english, `%${search}%`),
      )
    : undefined;
  const combinedWhere = search && searchWhere
    ? and(baseWhere, searchWhere)
    : baseWhere;

  // Real total count (ignoring limit/offset)
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(wordsTable)
    .where(combinedWhere);

  let query = db
    .select()
    .from(wordsTable)
    .where(combinedWhere)
    .$dynamic();

  if (sortBy === "russian") {
    query = query.orderBy(asc(wordsTable.russian));
  } else if (sortBy === "createdAt") {
    query = query.orderBy(desc(wordsTable.createdAt));
  } else {
    query = query.orderBy(asc(wordsTable.frequencyRank), asc(wordsTable.id));
  }

  const words = await query.limit(limit).offset(offset);
  res.json(ListWordsResponse.parse({ words, total: total ?? 0 }));
});

// ─── Trash (soft-deleted words) ──────────────────────────────────────────────
router.get("/words/trash", async (_req, res): Promise<void> => {
  const words = await db
    .select()
    .from(wordsTable)
    .where(isNotNull(wordsTable.deletedAt))
    .orderBy(desc(wordsTable.deletedAt));
  res.json(ListWordsResponse.parse({ words, total: words.length }));
});

// ─── Export (all active words + history) ─────────────────────────────────────
router.get("/words/export", async (_req, res): Promise<void> => {
  const words = await db
    .select()
    .from(wordsTable)
    .where(isNull(wordsTable.deletedAt))
    .orderBy(asc(wordsTable.id));

  const events = await db
    .select()
    .from(wordEventsTable)
    .orderBy(asc(wordEventsTable.wordId), asc(wordEventsTable.createdAt));

  const eventsByWord: Record<number, typeof events> = {};
  for (const e of events) {
    if (!eventsByWord[e.wordId]) eventsByWord[e.wordId] = [];
    eventsByWord[e.wordId].push(e);
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    words: words.map((w) => ({
      ...w,
      events: eventsByWord[w.id] ?? [],
    })),
  };

  res.json(exportData);
});

// ─── Translation via MyMemory (free, no API key needed) ──────────────────────
router.post("/words/translate", async (req, res): Promise<void> => {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Параметр text обязателен" });
    return;
  }
  const word = text.trim();

  async function translate(langpair: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${langpair}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json() as { responseData?: { translatedText?: string }; responseStatus?: number };
    if (json.responseStatus !== 200 && json.responseStatus !== "200" as unknown) throw new Error("Translation failed");
    return (json.responseData?.translatedText ?? "").trim();
  }

  // true when the Russian input is a single word (no spaces)
  const isSingleWordInput = !word.includes(" ");

  // Filter out bad MyMemory results: "?", punctuation-only, or the original word echoed back
  function clean(result: string): string | null {
    const t = result.trim();
    if (!t) return null;
    // Remove if it's just punctuation/symbols
    if (/^[?,.\s!*]+$/.test(t)) return null;
    // Remove if it matches the original word (case-insensitive, ignoring punctuation)
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-zа-яёa-ząćęłńóśźż]/gi, "");
    if (normalize(t) === normalize(word)) return null;
    // Remove trailing/leading commas, question marks, junk
    let cleaned = t.replace(/^[,?.\s]+|[,?.\s]+$/g, "").trim();
    if (!cleaned) return null;
    // For single-word Russian input, trim translation to 1-2 words max.
    // German translations often need article + noun (der/die/das + word), so keep 2 words for German.
    // For Polish and English, keep only the first word.
    if (isSingleWordInput) {
      const words = cleaned.split(/\s+/);
      if (words.length > 1) {
        const germanArticles = new Set(["der", "die", "das", "ein", "eine", "einem", "einen", "einer", "des", "dem"]);
        if (words[0] && germanArticles.has(words[0].toLowerCase())) {
          // Keep "der/die/das + noun"
          cleaned = words.slice(0, 2).join(" ");
        } else {
          // Take only the first word (removes context like "badanie naukowe" → "badanie")
          cleaned = words[0] ?? cleaned;
        }
      }
    }
    return cleaned || null;
  }

  try {
    const [polish, german, english] = await Promise.allSettled([
      translate("ru|pl"),
      translate("ru|de"),
      translate("ru|en"),
    ]);

    res.json({
      polish:  polish.status  === "fulfilled" ? clean(polish.value)  : null,
      german:  german.status  === "fulfilled" ? clean(german.value)  : null,
      english: english.status === "fulfilled" ? clean(english.value) : null,
    });
  } catch {
    res.status(502).json({ error: "Сервис перевода недоступен" });
  }
});

// ─── Fetch-sheet proxy (Google Sheets / public CSV URL) ──────────────────────
router.get("/words/fetch-sheet", async (req, res): Promise<void> => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    res.status(400).json({ error: "Параметр url обязателен" });
    return;
  }

  let fetchUrl = rawUrl.trim();

  const sheetMatch = fetchUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch) {
    const sheetId = sheetMatch[1];
    const gidMatch = fetchUrl.match(/[?&#]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    fetchUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  try {
    const response = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    if (!response.ok) {
      res.status(400).json({ error: `Не удалось загрузить: HTTP ${response.status}` });
      return;
    }
    const text = await response.text();
    res.type("text/plain; charset=utf-8").send(text);
  } catch {
    res.status(500).json({ error: "Ошибка при загрузке файла" });
  }
});

// ─── Get single word ──────────────────────────────────────────────────────────
router.get("/words/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetWordParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [word] = await db.select().from(wordsTable).where(eq(wordsTable.id, params.data.id));
  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }
  res.json(GetWordResponse.parse(word));
});

// ─── Mark as familiar (skip Прописи → enter SRS directly) ───────────────────
router.post("/words/:id/mark-familiar", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [word] = await db.select().from(wordsTable).where(eq(wordsTable.id, id));
  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }

  // Get settings to compute next review session using the first interval
  const [settings] = await db.select().from(settingsTable);
  const intervals = settings?.reviewIntervals?.split(",").map(Number).filter(Boolean) ?? [3, 5, 9, 13];
  const totalSessions = settings?.totalSessions ?? 0;
  const firstInterval = intervals[0] ?? 3;
  const nextReviewSession = totalSessions + firstInterval;

  const [updated] = await db
    .update(wordsTable)
    .set({
      nextReviewAt: new Date(),       // marks as "in SRS queue" (not new)
      nextReviewSession,              // due after first interval
      reviewInterval: 1,             // already past first review
      priority: 0,
    })
    .where(eq(wordsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Word not found" });
    return;
  }
  res.json(updated);
});

// ─── Restore from trash ───────────────────────────────────────────────────────
router.post("/words/:id/restore", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [word] = await db
    .update(wordsTable)
    .set({ deletedAt: null })
    .where(eq(wordsTable.id, id))
    .returning();

  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }
  res.json(word);
});

// ─── Word history ─────────────────────────────────────────────────────────────
router.get("/words/:id/history", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const events = await db
    .select()
    .from(wordEventsTable)
    .where(eq(wordEventsTable.wordId, id))
    .orderBy(desc(wordEventsTable.createdAt))
    .limit(50);

  res.json({ wordId: id, events });
});

// ─── Update word ──────────────────────────────────────────────────────────────
router.patch("/words/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateWordParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [word] = await db
    .update(wordsTable)
    .set(parsed.data)
    .where(eq(wordsTable.id, params.data.id))
    .returning();

  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }

  res.json(UpdateWordResponse.parse(word));
});

// ─── Permanent delete one word ────────────────────────────────────────────────
router.delete("/words/:id/permanent", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Also remove associated events
  await db.delete(wordEventsTable).where(eq(wordEventsTable.wordId, id));
  const [deleted] = await db
    .delete(wordsTable)
    .where(and(eq(wordsTable.id, id), isNotNull(wordsTable.deletedAt)))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Word not found in trash" }); return; }
  res.sendStatus(204);
});

// ─── Permanent delete ALL trashed words ───────────────────────────────────────
router.delete("/words/trash", async (_req, res): Promise<void> => {
  const trashed = await db
    .select({ id: wordsTable.id })
    .from(wordsTable)
    .where(isNotNull(wordsTable.deletedAt));

  if (trashed.length > 0) {
    const ids = trashed.map(w => w.id);
    for (const id of ids) {
      await db.delete(wordEventsTable).where(eq(wordEventsTable.wordId, id));
    }
    await db.delete(wordsTable).where(isNotNull(wordsTable.deletedAt));
  }

  res.json({ deleted: trashed.length });
});

// ─── Soft delete (move to trash) ─────────────────────────────────────────────
router.delete("/words/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteWordParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [word] = await db
    .update(wordsTable)
    .set({ deletedAt: new Date() })
    .where(eq(wordsTable.id, params.data.id))
    .returning();

  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }

  res.sendStatus(204);
});

// ─── Bulk import ──────────────────────────────────────────────────────────────
router.post("/words/bulk-import", async (req, res): Promise<void> => {
  const parsed = BulkImportWordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const wordData of parsed.data.words) {
    try {
      const existing = await db
        .select({ id: wordsTable.id })
        .from(wordsTable)
        .where(eq(wordsTable.russian, wordData.russian))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(wordsTable).values(wordData);
      imported++;
    } catch (e) {
      errors.push(`Error importing "${wordData.russian}": ${e}`);
    }
  }

  res.json(BulkImportWordsResponse.parse({ imported, skipped, errors }));
});

export default router;
