import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import fs from "fs/promises";
import path from "path";
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
    graduationThreshold: row.graduationThreshold,
    appName: row.appName,
  };
}

// Update manifest.json with new app name
async function updateManifest(appName: string): Promise<void> {
  try {
    const manifestPath = path.resolve(process.cwd(), "../vocab-app/public/manifest.json");
    const raw = await fs.readFile(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);
    manifest.name = `${appName} — Интервальное повторение`;
    manifest.short_name = appName;
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  } catch {
    // Non-fatal: manifest update is best-effort
  }
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
  if (parsed.data.graduationThreshold !== undefined) {
    updateData.graduationThreshold = parsed.data.graduationThreshold;
  }
  if (parsed.data.appName !== undefined) {
    updateData.appName = parsed.data.appName;
    await updateManifest(parsed.data.appName);
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

// Upload custom app icon — saves to vocab-app/public/ and updates manifest
router.post("/app-icon", async (req, res): Promise<void> => {
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "Invalid image data" });
    return;
  }

  try {
    const base64 = dataUrl.split(",")[1];
    if (!base64) { res.status(400).json({ error: "Invalid data URL" }); return; }
    const buffer = Buffer.from(base64, "base64");
    // process.cwd() = artifacts/api-server/, so go one level up to workspace root
    const publicDir = path.resolve(process.cwd(), "../vocab-app/public");

    // Write icon at two sizes (same source, browser will resize for display)
    await fs.writeFile(path.join(publicDir, "icon-192.png"), buffer);
    await fs.writeFile(path.join(publicDir, "icon-512.png"), buffer);
    await fs.writeFile(path.join(publicDir, "apple-touch-icon.png"), buffer);

    res.json({ ok: true });
  } catch (err) {
    console.error("Icon upload error:", err);
    res.status(500).json({ error: "Failed to save icon" });
  }
});

export default router;
