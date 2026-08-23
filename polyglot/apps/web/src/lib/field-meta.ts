/**
 * Single source of truth for field display metadata.
 * Change a label/emoji here → it updates everywhere automatically:
 * WordDialog labels, WordRow badges, filter dropdowns, dashboard headings,
 * trace-trainer edit panel.
 */

export const MNEMONIC_GROUP = {
  /** Short display label used in badges, filter dropdowns, dashboard headings */
  label: "Мнемо-группа",
  /** Plural form for headings ("Мнемо-группы") */
  labelPlural: "Мнемо-группы",
  /** "All …" option in filter dropdowns */
  labelAll: "Все мнемо-группы",
  /** Full label used in form fields */
  labelFull: "Мнемоническая группа",
  /** Prefix emoji shown in badges and headings */
  emoji: "🧠",
  /** Input placeholder */
  placeholder: "дерево-23, звук-ш…",
  /** Helper text shown below the form field */
  hint: "Слова с одной техникой запоминания — помогает работать блоками по методике.",
} as const;

export const SEMANTIC_GROUP = {
  label: "Смысл-группа",
  labelPlural: "Смысл-группы",
  labelAll: "Все смысл-группы",
  labelFull: "Смысловая группа",
  emoji: "≈",
  placeholder: "начать, убивать…",
  hint: "Синонимы или взаимозаменяемые слова — объединяй слова с одним смыслом, чтобы отрабатывать их вместе.",
} as const;
