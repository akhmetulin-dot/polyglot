# Карта жизни

Offline-first mind map PWA. Maps are edited locally and survive without a
network; the API stores them server-side so they can be carried between
devices. Nodes form a tree with fractional ordering, so a node can be dragged
between two siblings without renumbering the rest.

This is a self-contained pnpm workspace. It shares nothing with the Полиглот
project — separate database, separate dependencies, separate Netlify site.

## Layout

```
apps/web/                  React 19 + Vite 7 + Tailwind 4 PWA
apps/api/                  Express 5 API
packages/db/               Drizzle schema, migrations, pool
packages/api-spec/         OpenAPI contract + Orval codegen config
packages/api-client-react/ generated react-query hooks  (do not edit)
packages/api-zod/          generated Zod schemas        (do not edit)
netlify/functions/api.mts  serves the Express app as a Netlify Function
```

`apps/web` talks to the API only through the generated client, and the client
is generated from `packages/api-spec/openapi.yaml`. That file is the contract:
change it, run `pnpm codegen`, and the typechecker will point at every call
site that needs updating.

## Requirements

- Node 20 or newer (Netlify builds on 22)
- pnpm
- A Postgres database

## Setup

```bash
pnpm install
cp .env.example .env      # then edit DATABASE_URL
pnpm db:migrate           # create the tables
pnpm dev                  # web app on http://localhost:5173
```

`pnpm dev` runs only the front end, which proxies `/api` to
`http://localhost:5001`. Run the API next to it in a second terminal:

```bash
pnpm dev:api              # http://localhost:5001
```

To exercise the app the way Netlify serves it — SPA and function behind one
origin, no proxy — use the Netlify CLI instead:

```bash
netlify dev --filter @mindmap/web
```

The `--filter` is required: the CLI otherwise finds several packages in the
workspace and stops to ask which one to serve.

The service worker registers in dev too, which means a stale cache can hide
your changes. If the browser seems to be serving an old build, unregister it
in DevTools → Application → Service Workers. To test offline behaviour against
a real build, run `pnpm build` and then `pnpm --filter @mindmap/web preview`.

## Database

The only required variable is `DATABASE_URL`. Any Postgres works — the schema
uses no vendor-specific features.

**Supabase**: Project Settings → Database → Connection string → *Transaction
pooler*, then append `?sslmode=require`:

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
```

Point this at a **different database than Полиглот**. The two projects are
independent and their migrations each start from `0000`; sharing one database
would let them collide.

The transaction pooler is the right choice for serverless functions. SSL is
enabled automatically whenever the URL carries `sslmode=require`, `verify-ca`
or `verify-full`; override with `PGSSL=0` or `PGSSL=1` if you need to.
`NETLIFY_DATABASE_URL` is read as a fallback, so Netlify DB works with no
configuration at all. Pool size defaults to 5 connections and is set with
`PGPOOL_MAX`.

| Command           | What it does                                                  |
| ----------------- | ------------------------------------------------------------- |
| `pnpm db:generate` | write a new SQL migration from schema changes (works offline) |
| `pnpm db:migrate`  | apply pending migrations                                      |
| `pnpm db:push`     | push the schema straight to the database, no migration file   |
| `pnpm --filter @mindmap/db studio` | open Drizzle Studio                           |

Use `db:push` for throwaway local databases and `db:generate` + `db:migrate`
for anything you care about. Tables: `mindmaps`, `mindmap_nodes`.

## Commands

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `pnpm dev`         | front end with hot reload                             |
| `pnpm dev:api`     | API with hot reload and pretty logs                   |
| `pnpm build`       | typecheck, bundle the API, build the front end        |
| `pnpm typecheck`   | whole workspace, including the Netlify function       |
| `pnpm codegen`     | regenerate the API client and Zod schemas from OpenAPI |

Orval is pinned to an exact version: 8.22 and later emit Zod 4 syntax
(`z.int()`), which this project's Zod 3 does not have. Upgrade both together
or not at all.

## Deploying to Netlify

`netlify.toml` in this folder holds the build settings, so the only thing to
configure in the UI is:

- **Base directory** — `mindmap` (leave empty once this project has its own
  repository)
- **Environment** — `DATABASE_URL`

Build command, publish directory, functions directory, Node version and the
SPA redirect all come from `netlify.toml`.

The build produces a static site in `apps/web/dist` and one function that
serves the whole Express app: `netlify/functions/api.mts` starts the app on a
loopback port on first request and forwards `/api/*` to it, so the same code
runs locally under `pnpm dev:api` and in production under Netlify, with no
framework adapter in between.
