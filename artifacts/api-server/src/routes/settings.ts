import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function ensureSettings() {
  const [existing] = await db.select().from(settingsTable);
  if (existing) return existing;
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created;
}

function parseSettings(row: typeof settingsTable.$inferSelect) {
  return {
    id: row.id,
    errorRepeatAfter: row.errorRepeatAfter,
    reviewIntervals: row.reviewIntervals.split(",").map(Number).filter(Boolean),
    sessionSize: row.sessionSize,
    reviewSessionSize: row.reviewSessionSize,
    totalSessions: row.totalSessions,
    traceSessionSize: row.traceSessionSize,
    traceNew: row.traceNew,
    traceReview: row.traceReview,
    traceError: row.traceError,
    traceErrorReview: row.traceErrorReview,
  };
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await ensureSettings();
  res.json(GetSettingsResponse.parse(parseSettings(settings)));
});

router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await ensureSettings();
  const updateData: Partial<typeof settingsTable.$inferInsert> = {};

  if (parsed.data.errorRepeatAfter !== undefined) {
    updateData.errorRepeatAfter = parsed.data.errorRepeatAfter;
  }
  if (parsed.data.reviewIntervals !== undefined) {
    updateData.reviewIntervals = parsed.data.reviewIntervals.join(",");
  }
  if (parsed.data.sessionSize !== undefined) {
    updateData.sessionSize = parsed.data.sessionSize;
  }
  if (parsed.data.reviewSessionSize !== undefined) {
    updateData.reviewSessionSize = parsed.data.reviewSessionSize;
  }
  if (parsed.data.traceSessionSize !== undefined) {
    updateData.traceSessionSize = parsed.data.traceSessionSize;
  }
  if (parsed.data.traceNew !== undefined) {
    updateData.traceNew = parsed.data.traceNew;
  }
  if (parsed.data.traceReview !== undefined) {
    updateData.traceReview = parsed.data.traceReview;
  }
  if (parsed.data.traceError !== undefined) {
    updateData.traceError = parsed.data.traceError;
  }
  if (parsed.data.traceErrorReview !== undefined) {
    updateData.traceErrorReview = parsed.data.traceErrorReview;
  }

  const [updated] = await db
    .update(settingsTable)
    .set(updateData)
    .where(eq(settingsTable.id, existing.id))
    .returning();

  // If no rows returned (shouldn't happen), return existing
  const result = updated ?? existing;
  res.json(UpdateSettingsResponse.parse(parseSettings(result)));
});

export default router;
