import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./index.js";

async function main(): Promise<void> {
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "drizzle",
  );

  const pool = createPool();
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder });
  await pool.end();

  console.log("Migrations applied.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
