import { Router, type IRouter } from "express";
import { eq, ilike, or, asc, desc, isNull, isNotNull } from "drizzle-orm";
import { db, wordsTable, wordEventsTable } from "@workspace/db";
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

  const { search, sortBy, limit = 50, offset = 0 } = parsed.data;

  let query = db
    .select()
    .from(wordsTable)
    .where(isNull(wordsTable.deletedAt))
    .$dynamic();

  if (search) {
    query = query.where(
      or(
        ilike(wordsTable.russian, `%${search}%`),
        ilike(wordsTable.polish, `%${search}%`),
        ilike(wordsTable.german, `%${search}%`),
        ilike(wordsTable.english, `%${search}%`),
      ),
    );
  }

  if (sortBy === "russian") {
    query = query.orderBy(asc(wordsTable.russian));
  } else if (sortBy === "createdAt") {
    query = query.orderBy(desc(wordsTable.createdAt));
  } else {
    query = query.orderBy(asc(wordsTable.frequencyRank), asc(wordsTable.id));
  }

  const words = await query.limit(limit).offset(offset);
  res.json(ListWordsResponse.parse({ words, total: words.length }));
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
