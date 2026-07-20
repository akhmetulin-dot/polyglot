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
  nextReviewAt: timestamp("next_review_at"),
  reviewInterval: integer("review_interval").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWordSchema = createInsertSchema(wordsTable).omit({ id: true, createdAt: true });
export type InsertWord = z.infer<typeof insertWordSchema>;
export type Word = typeof wordsTable.$inferSelect;
