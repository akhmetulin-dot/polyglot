---
name: Mindmap app architecture
description: Key decisions for the mindmap-app artifact — sync model, canvas rendering, state management, and deployment gotchas
---

## Sync model
- Client-generated UUIDs for map/node IDs so offline creates work without server.
- Whole-map node snapshot via `PUT /api/mindmaps/{id}/nodes` with `baseRevision` / 409 conflict + `force` flag.
- IndexedDB (`idb.ts`) is source of truth; `sync.ts` pushes dirty maps and pulls server-only maps via `subscribeToDataChanges` / `notifyDataChanged`.
- `runBackgroundSync()` must be called from BOTH `use-mindmaps.ts` (home page) AND `use-map-editor.ts` (editor page). If only called from home, deep-linking to editor leaves canvas blank.

## Canvas rendering (MapCanvas.tsx)
- Hybrid SVG (bezier links) + HTML div overlay (node text) — avoids SVG `foreignObject` bugs.
- Layout coordinates can be negative (tree centered at y=0, root at −subtreeHeight/2). Default transform `{x:60, y:400}` keeps root visible before `doFit()` fires.
- `doFit()` must read bounds via `layoutRef` (ref, not closure) — stale closure causes blank canvas after async data load.
- Node widths estimated by character count (`estimateWidth`); inaccurate for CJK/emoji — see follow-up task #3.

## State mutation (use-map-editor.ts)
- All mutations go through `commitNodes(newNodes)` which writes `nodesRef.current` THEN calls `setNodes`. Never mutate inside a React state updater (runs twice in StrictMode → double apply).
- `scheduleSave` uses `replaceNodes(mapId, nodes)` (not `saveNodes`) to persist deletions — `saveNodes` only upserts, won't remove deleted nodes from IndexedDB.

## UI style (Фокус-inspired)
- Bottom toolbar: ⊙ options, 🗑 delete, ＋ add-child (large teal), ⤢ fit-to-screen.
- Nodes: plain text, no pill border by default; selected gets `ring-1 ring-primary/60`.
- Collapse toggle: small circle on LEFT of node label; badge shows descendant count when collapsed.

## Deployment / migration
- Drizzle migration `0001_productive_expediter.sql` adds `mindmaps` + `mindmap_nodes` tables (text PKs, FK cascade).
- `drizzle.config.ts` has no `out` field; run `drizzle-kit generate --config ./drizzle.config.ts` from `lib/db/` to produce migration files.
- `vite.config.ts` must NOT throw on missing `PORT`/`BASE_PATH` — use graceful fallbacks (`port = rawPort ? Number(rawPort) : 5173`, `basePath = process.env.BASE_PATH ?? '/mindmap-app/'`).

**Why:** Hard throws in vite.config.ts break typecheck and build in non-Replit CI environments.
