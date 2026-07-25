import { pgTable, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const mindmapsTable = pgTable("mindmaps", {
  // Client-generated UUID so offline-created maps keep their id after sync
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // Server revision counter, incremented on every accepted nodes snapshot
  revision: integer("revision").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const mindmapNodesTable = pgTable("mindmap_nodes", {
  // Client-generated UUID
  id: text("id").primaryKey(),
  mapId: text("map_id")
    .notNull()
    .references(() => mindmapsTable.id, { onDelete: "cascade" }),
  // null = root node
  parentId: text("parent_id"),
  text: text("text").notNull().default(""),
  order: real("order").notNull().default(0),
  collapsed: boolean("collapsed").notNull().default(false),
});

export type Mindmap = typeof mindmapsTable.$inferSelect;
export type MindmapNode = typeof mindmapNodesTable.$inferSelect;
