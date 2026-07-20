import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  errorRepeatAfter: integer("error_repeat_after").notNull().default(5),
  reviewIntervals: text("review_intervals").notNull().default("1,3,7,14,30,90"),
  sessionSize: integer("session_size").notNull().default(20),
  reviewSessionSize: integer("review_session_size").notNull().default(20),
});

export type Settings = typeof settingsTable.$inferSelect;
