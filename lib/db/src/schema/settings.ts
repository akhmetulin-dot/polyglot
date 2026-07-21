import { pgTable, serial, integer, text } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  errorRepeatAfter: integer("error_repeat_after").notNull().default(5),
  // Intervals in SESSIONS (not days): after N completed sessions the word reappears
  reviewIntervals: text("review_intervals").notNull().default("3,5,9,13"),
  sessionSize: integer("session_size").notNull().default(20),
  reviewSessionSize: integer("review_session_size").notNull().default(20),
  // Global session counter — incremented each time a training/review session is completed
  totalSessions: integer("total_sessions").notNull().default(0),
  // Number of words per Прописи session (separate from Тест sessionSize)
  traceSessionSize: integer("trace_session_size").notNull().default(10),
  // Trace (письмо-обводка) repetition counts per word category
  traceNew: integer("trace_new").notNull().default(3),
  traceReview: integer("trace_review").notNull().default(2),
  traceError: integer("trace_error").notNull().default(5),
  traceErrorReview: integer("trace_error_review").notNull().default(5),
  // After this many consecutive correct SRS answers the word is graduated (fully learned)
  graduationThreshold: integer("graduation_threshold").notNull().default(7),
});

export type Settings = typeof settingsTable.$inferSelect;
