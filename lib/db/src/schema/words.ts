import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const wordsTable = pgTable("words", {
  id: serial("id").primaryKey(),
  russian: text("russian").notNull(),
  polish: text("polish"),
  german: text("german"),
  english: text("english"),
  mnemonic: text("mnemonic"),
  frequencyRank: integer("frequency_rank"),
  correctCount: integer("correct_count").notNull().default(0),
  hintCount: integer("hint_count").notNull().default(0),
  // nextReviewAt kept as a boolean marker: null = new word, non-null = in SRS queue
  nextReviewAt: timestamp("next_review_at"),
  // nextReviewSession: the global session number at which this word is due for review
  nextReviewSession: integer("next_review_session"),
  // reviewInterval: index into the intervals array (how many times reviewed correctly)
  reviewInterval: integer("review_interval").notNull().default(0),
  // Word usage context: academic | everyday | mixed | null (unknown)
  wordType: text("word_type"),
  // Semantic group label — for tagging synonyms/thematic clusters (e.g. "движение", "эмоции")
  wordGroup: text("word_group"),
  // Priority for Прописи ordering: 0 = normal, 1 = high (wrong-answer words come first)
  priority: integer("priority").notNull().default(0),
  // Soft delete: null = active, non-null = in trash
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWordSchema = createInsertSchema(wordsTable).omit({ id: true, createdAt: true });
export type InsertWord = z.infer<typeof insertWordSchema>;
export type Word = typeof wordsTable.$inferSelect;
