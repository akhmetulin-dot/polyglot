import { Router, type IRouter } from "express";
import { eq, ilike, or, asc, desc } from "drizzle-orm";
import { db, wordsTable } from "@workspace/db";
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

router.get("/words", async (req, res): Promise<void> => {
  const parsed = ListWordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, sortBy, limit = 50, offset = 0 } = parsed.data;

  let query = db.select().from(wordsTable).$dynamic();

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
    // Default: sort by frequencyRank (nulls last), then id
    query = query.orderBy(asc(wordsTable.frequencyRank), asc(wordsTable.id));
  }

  query = query.limit(limit).offset(offset);

  const words = await query;
  const total = words.length + (offset ?? 0);

  res.json(ListWordsResponse.parse({ words, total }));
});

router.post("/words", async (req, res): Promise<void> => {
  const parsed = CreateWordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [word] = await db.insert(wordsTable).values(parsed.data).returning();
  res.status(201).json(CreateWordResponse.parse(word));
});

router.get("/words/bulk-import", async (_req, res): Promise<void> => {
  res.json({ message: "Use POST /words/bulk-import to import words" });
});

router.post("/words/bulk-import", async (req, res): Promise<void> => {
  const parsed = BulkImportWordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (const wordInput of parsed.data.words) {
    try {
      if (!wordInput.russian?.trim()) {
        errors.push(`Skipped word without Russian: ${JSON.stringify(wordInput)}`);
        skipped++;
        continue;
      }
      await db.insert(wordsTable).values(wordInput);
      imported++;
    } catch (err) {
      errors.push(`Error importing "${wordInput.russian}": ${String(err)}`);
      skipped++;
    }
  }

  res.json(BulkImportWordsResponse.parse({ imported, skipped, errors }));
});

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

router.delete("/words/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteWordParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [word] = await db.delete(wordsTable).where(eq(wordsTable.id, params.data.id)).returning();
  if (!word) {
    res.status(404).json({ error: "Word not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
