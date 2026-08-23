import { defineConfig } from "drizzle-kit";

// `generate` works offline and needs no credentials; `push`/`studio` require
// DATABASE_URL to be set.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL ?? "",
  },
});
