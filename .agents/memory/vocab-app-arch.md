---
name: Vocab app architecture
description: Key schema, routing, and behavioral decisions for the polyglot vocab trainer
---

## SRS is session-based, not day-based
- `nextReviewAt` is a boolean marker only (null = new, non-null = in queue)
- Scheduling done via `nextReviewSession` (integer) vs `settingsTable.totalSessions`
- `POST /training/complete` increments totalSessions; called by frontend when trainer finishes

**Why:** User wanted sessions, not days, as the repetition unit.

## Word events table (`word_events`)
- Tracks: correct | wrong | hint | review_correct | review_wrong events per word
- Used for per-card analytics (shown in word edit dialog)
- Export via `GET /words/export` returns words + full event history

## Soft delete
- Words have `deletedAt` timestamp; null = active, non-null = trash
- `DELETE /words/:id` sets deletedAt (soft); `POST /words/:id/restore` clears it
- `GET /words/trash` lists trashed words; main list filters `deletedAt IS NULL`

**Why:** User wanted a recycle bin to recover mistakes.

## Trace trainer ("Прописи")
- Separate `/trace` page using `Word[]` (not TrainingWord) from word list
- `TraceTrainer` component shows N repetition rows per word; each row = Russian bold + PL/DE/EN inputs with placeholder ghost text
- When all 3 inputs match the expected values → row flashes green → next row auto-focuses
- Settings: `traceNew`, `traceReview`, `traceError`, `traceErrorReview` (all int, default 3/2/5/5)

## Reinforcement tracing in main trainer
- After correct answer → 700ms success shake → `tracingWord` state shows tracing panel
- User re-types all 3 translations over ghost-text placeholders → when all match → flash → advanceNext
- User can "Пропустить" (skip) to advance immediately

## Import formats
- Frontend: CSV/TSV auto-detect (tab vs comma), XLSX via `xlsx` library, XML via DOMParser
- Paste mode: textarea → detect separator → parse
- URL mode: server proxy at `GET /words/fetch-sheet?url=...` converts Google Sheets URL to CSV export URL

## Codegen command
`pnpm --filter @workspace/api-spec run codegen` from workspace root
API server must be restarted after any route change (pre-builds with esbuild).

## TypeScript quirk for conditional hook enabling
Use `{ query: { enabled: ... } as never }` to pass enabled option to generated orval hooks that require `queryKey` in UseQueryOptions type.
