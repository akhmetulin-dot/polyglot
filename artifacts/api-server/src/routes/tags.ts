import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, customTagsTable } from "@workspace/db";

const router: IRouter = Router();

const WORD_TYPE_DEFAULTS = [
  { value: "academic",  label: "Академическое", sortOrder: 0 },
  { value: "everyday",  label: "Базовое",        sortOrder: 1 },
  { value: "mixed",     label: "Смешанное",       sortOrder: 2 },
];

// ─── List tags (optionally filter by kind) ───────────────────────────────────
router.get("/tags", async (req, res): Promise<void> => {
  const kind = req.query.kind as string | undefined;

  // Auto-seed word_type defaults on first access
  if (!kind || kind === "word_type") {
    const existing = await db
      .select({ id: customTagsTable.id })
      .from(customTagsTable)
      .where(eq(customTagsTable.kind, "word_type"))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(customTagsTable).values(
        WORD_TYPE_DEFAULTS.map(d => ({ kind: "word_type", ...d }))
      ).onConflictDoNothing();
    }
  }

  const rows = await db
    .select()
    .from(customTagsTable)
    .where(kind ? eq(customTagsTable.kind, kind) : undefined)
    .orderBy(customTagsTable.sortOrder, customTagsTable.label);

  res.json({ tags: rows });
});

// ─── Create tag ───────────────────────────────────────────────────────────────
router.post("/tags", async (req, res): Promise<void> => {
  const { kind, value, label, sortOrder } = req.body as {
    kind?: string; value?: string; label?: string; sortOrder?: number;
  };

  if (!kind || !value || !label) {
    res.status(400).json({ error: "kind, value и label обязательны" });
    return;
  }

  try {
    const [tag] = await db
      .insert(customTagsTable)
      .values({ kind, value, label, sortOrder: sortOrder ?? 0 })
      .returning();
    res.status(201).json(tag);
  } catch {
    res.status(409).json({ error: "Тег с таким значением уже существует" });
  }
});

// ─── Update tag ───────────────────────────────────────────────────────────────
router.put("/tags/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { label, sortOrder } = req.body as { label?: string; sortOrder?: number };
  const patch: Record<string, unknown> = {};
  if (label !== undefined) patch["label"] = label;
  if (sortOrder !== undefined) patch["sortOrder"] = sortOrder;

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Нет полей для обновления" });
    return;
  }

  const [tag] = await db
    .update(customTagsTable)
    .set(patch)
    .where(eq(customTagsTable.id, id))
    .returning();

  if (!tag) { res.status(404).json({ error: "Tag not found" }); return; }
  res.json(tag);
});

// ─── Delete tag ───────────────────────────────────────────────────────────────
router.delete("/tags/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [deleted] = await db
    .delete(customTagsTable)
    .where(eq(customTagsTable.id, id))
    .returning();

  if (!deleted) { res.status(404).json({ error: "Tag not found" }); return; }
  res.sendStatus(204);
});

export default router;
