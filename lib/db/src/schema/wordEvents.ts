import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { wordsTable } from "./words";

// Records every training/review event for a word — enables per-word analytics and history export
export const wordEventsTable = pgTable("word_events", {
  id: serial("id").primaryKey(),
  wordId: integer("word_id")
    .notNull()
    .references(() => wordsTable.id, { onDelete: "cascade" }),
  // Event types: correct | wrong | hint | review_correct | review_wrong
  eventType: text("event_type").notNull(),
  // Global session number at the time of the event
  sessionNumber: integer("session_number").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WordEvent = typeof wordEventsTable.$inferSelect;
