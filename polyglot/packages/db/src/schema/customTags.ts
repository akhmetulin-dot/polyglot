import { pgTable, serial, text, integer, unique } from "drizzle-orm/pg-core";

// Manages user-defined lists for word classification:
//   kind = 'mnemonic_group' | 'semantic_group' | 'word_type'
// For groups: value === label (the name stored in words.wordGroup / words.semanticGroup)
// For word_type: value = key stored in words.wordType (e.g. 'academic'), label = display name
export const customTagsTable = pgTable("custom_tags", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(), // 'mnemonic_group' | 'semantic_group' | 'word_type'
  value: text("value").notNull(), // stored value
  label: text("label").notNull(), // display label
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [
  unique("custom_tags_kind_value_unique").on(t.kind, t.value),
]);

export type CustomTag = typeof customTagsTable.$inferSelect;
