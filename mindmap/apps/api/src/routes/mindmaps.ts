import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, mindmapsTable, mindmapNodesTable } from "@mindmap/db";

const router: IRouter = Router();

type NodeInput = {
  id: string;
  parentId: string | null;
  text: string;
  order: number;
  collapsed: boolean;
};

function serializeMap(
  map: typeof mindmapsTable.$inferSelect,
  nodeCount?: number,
) {
  return {
    id: map.id,
    title: map.title,
    revision: map.revision,
    ...(nodeCount !== undefined ? { nodeCount } : {}),
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
  };
}

// ─── List maps ───────────────────────────────────────────────────────────────
router.get("/mindmaps", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      map: mindmapsTable,
      nodeCount: sql<number>`count(${mindmapNodesTable.id})::int`,
    })
    .from(mindmapsTable)
    .leftJoin(
      mindmapNodesTable,
      eq(mindmapNodesTable.mapId, mindmapsTable.id),
    )
    .groupBy(mindmapsTable.id)
    .orderBy(mindmapsTable.updatedAt);

  res.json({
    maps: rows.map((r) => serializeMap(r.map, r.nodeCount)).reverse(),
  });
});

// ─── Create map ──────────────────────────────────────────────────────────────
router.post("/mindmaps", async (req, res): Promise<void> => {
  const { id, title } = req.body as { id?: string; title?: string };

  if (!id || typeof id !== "string" || !title || typeof title !== "string") {
    res.status(400).json({ error: "id и title обязательны" });
    return;
  }

  const [existing] = await db
    .select()
    .from(mindmapsTable)
    .where(eq(mindmapsTable.id, id));

  if (existing) {
    // Idempotent: offline queue may retry the same create
    res.status(201).json(serializeMap(existing));
    return;
  }

  const [map] = await db
    .insert(mindmapsTable)
    .values({ id, title })
    .returning();

  res.status(201).json(serializeMap(map!, 0));
});

// ─── Get map with nodes ──────────────────────────────────────────────────────
router.get("/mindmaps/:id", async (req, res): Promise<void> => {
  const id = req.params.id as string;

  const [map] = await db
    .select()
    .from(mindmapsTable)
    .where(eq(mindmapsTable.id, id));

  if (!map) {
    res.status(404).json({ error: "Карта не найдена" });
    return;
  }

  const nodes = await db
    .select()
    .from(mindmapNodesTable)
    .where(eq(mindmapNodesTable.mapId, id))
    .orderBy(mindmapNodesTable.order);

  res.json({
    map: serializeMap(map, nodes.length),
    nodes: nodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      text: n.text,
      order: n.order,
      collapsed: n.collapsed,
    })),
  });
});

// ─── Rename map ──────────────────────────────────────────────────────────────
router.patch("/mindmaps/:id", async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { title } = req.body as { title?: string };

  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title обязателен" });
    return;
  }

  const [map] = await db
    .update(mindmapsTable)
    .set({ title, updatedAt: new Date() })
    .where(eq(mindmapsTable.id, id))
    .returning();

  if (!map) {
    res.status(404).json({ error: "Карта не найдена" });
    return;
  }

  res.json(serializeMap(map));
});

// ─── Delete map (cascade removes nodes) ──────────────────────────────────────
router.delete("/mindmaps/:id", async (req, res): Promise<void> => {
  const id = req.params.id as string;

  const deleted = await db
    .delete(mindmapsTable)
    .where(eq(mindmapsTable.id, id))
    .returning({ id: mindmapsTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Карта не найдена" });
    return;
  }

  res.status(204).end();
});

// ─── Sync nodes snapshot ─────────────────────────────────────────────────────
router.put("/mindmaps/:id/nodes", async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { nodes, baseRevision, force } = req.body as {
    nodes?: NodeInput[];
    baseRevision?: number;
    force?: boolean;
  };

  if (!Array.isArray(nodes)) {
    res.status(400).json({ error: "nodes должен быть массивом" });
    return;
  }

  for (const n of nodes) {
    if (!n || typeof n.id !== "string" || typeof n.text !== "string") {
      res.status(400).json({ error: "Некорректный узел в снапшоте" });
      return;
    }
  }

  const [map] = await db
    .select()
    .from(mindmapsTable)
    .where(eq(mindmapsTable.id, id));

  if (!map) {
    res.status(404).json({ error: "Карта не найдена" });
    return;
  }

  if (
    !force &&
    typeof baseRevision === "number" &&
    baseRevision < map.revision
  ) {
    // Client is behind — return current server state for reconciliation
    const currentNodes = await db
      .select()
      .from(mindmapNodesTable)
      .where(eq(mindmapNodesTable.mapId, id))
      .orderBy(mindmapNodesTable.order);

    res.status(409).json({
      map: serializeMap(map, currentNodes.length),
      nodes: currentNodes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        text: n.text,
        order: n.order,
        collapsed: n.collapsed,
      })),
    });
    return;
  }

  const updated = await db.transaction(async (tx) => {
    await tx.delete(mindmapNodesTable).where(eq(mindmapNodesTable.mapId, id));

    if (nodes.length > 0) {
      // Insert in chunks to stay under parameter limits on large maps
      const chunkSize = 500;
      for (let i = 0; i < nodes.length; i += chunkSize) {
        await tx.insert(mindmapNodesTable).values(
          nodes.slice(i, i + chunkSize).map((n) => ({
            id: n.id,
            mapId: id,
            parentId: n.parentId ?? null,
            text: n.text,
            order: typeof n.order === "number" ? n.order : 0,
            collapsed: Boolean(n.collapsed),
          })),
        );
      }
    }

    const [m] = await tx
      .update(mindmapsTable)
      .set({ revision: map.revision + 1, updatedAt: new Date() })
      .where(eq(mindmapsTable.id, id))
      .returning();

    return m!;
  });

  res.json(serializeMap(updated, nodes.length));
});

export default router;
