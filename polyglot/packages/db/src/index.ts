import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

/**
 * Resolve the Postgres connection string.
 *
 * Any Postgres provider works — Supabase, Neon, Netlify DB, or a local server.
 * `NETLIFY_DATABASE_URL` is accepted as a fallback so a Netlify-provisioned
 * database works without extra configuration.
 */
export function getConnectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Copy .env.example to .env and point it at your Postgres instance.",
    );
  }

  return url;
}

// Hosted providers (Supabase, Neon, …) terminate TLS; a local server usually does not.
function needsSsl(url: string): boolean {
  if (process.env.PGSSL === "0") return false;
  if (process.env.PGSSL === "1") return true;
  return /[?&]sslmode=(require|verify-ca|verify-full)\b/.test(url);
}

export function createPool(): pg.Pool {
  const connectionString = getConnectionString();

  return new Pool({
    connectionString,
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    // Serverless invocations are short-lived and run many concurrent containers,
    // so keep each pool small. Use a Supabase/pgBouncer pooler URL in production.
    max: Number(process.env.PGPOOL_MAX ?? 5),
  });
}

export const pool: pg.Pool = createPool();
export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
