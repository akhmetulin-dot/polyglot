---
name: Vocab app priority & grouping — Jul 2026
description: DB schema additions, translator fix, mark-familiar endpoint, settings restructure
---

## priority column (words table)
- `priority integer NOT NULL DEFAULT 0` on `words` table.
- Wrong answer in Тест or Повторение → sets `priority = 1`.
- Correct answer → resets `priority = 0`.
- `GET /training/session` orders: `priority DESC, frequencyRank ASC, id ASC` — so returned words surface first in Прописи.
- Frontend shows amber "↑ приоритет" badge on word cards when priority > 0.

## wordGroup column (words table)
- `wordGroup text` on `words` table.
- Exposed in Word schema (openapi + zod + api-client-react).
- Input in add/edit dialog; shown as secondary badge on word cards.
- Purpose: user labels synonym/thematic clusters (e.g. "движение", "эмоции").

## traceSessionSize (settings table)
- `traceSessionSize integer NOT NULL DEFAULT 10` on `settings` table.
- Previously Прописи used `sessionSize` (same as Тест) — now has its own slider.
- `trace.tsx` uses `settings.traceSessionSize ?? 10`.
- Settings page restructured with flow diagram (Прописи → Тест → Повторение) and section cards per stage.

## clean() single-word trimming (words.ts translator)
- If Russian input is 1 word (no spaces), translation is trimmed:
  - German: keep first 2 words if first is an article (der/die/das/ein/eine…)
  - All others: keep only the first word
- Prevents MyMemory returning "badanie naukowe" instead of "badanie".

## mark-familiar endpoint
- `POST /api/words/:id/mark-familiar` in words.ts.
- Sets `nextReviewAt = now, nextReviewSession = totalSessions + intervals[0], reviewInterval = 1, priority = 0`.
- Skips Прописи — word goes straight to SRS queue.
- Frontend: star (⭐) icon button on word cards (only for new words where `nextReviewAt` is null).
- Hook: `useMarkWordFamiliar` from generated api-client-react.

## Codegen
- Run `pnpm --filter @workspace/api-spec run codegen` after any openapi.yaml change.
- ErrorResponse (not Error) is the correct schema ref for 404 responses.

**Why:** User feedback about confusing settings, translator adding extra words, and need to prioritize wrong-answer words in Прописи.
