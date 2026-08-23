import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm } from "node:fs/promises";
import { build as esbuild } from "esbuild";

const apiDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(apiDir, "dist");

// Two entry points:
//   index.mjs — standalone Node server (`pnpm start`)
//   app.mjs   — the bare Express app, imported by the Netlify function
//
// Both are bundled to plain JS so consumers never have to resolve TypeScript
// sources at runtime.
await rm(distDir, { recursive: true, force: true });

await esbuild({
  entryPoints: [
    path.resolve(apiDir, "src/index.ts"),
    path.resolve(apiDir, "src/app.ts"),
  ],
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: distDir,
  outExtension: { ".js": ".mjs" },
  sourcemap: "linked",
  logLevel: "info",
  // Native modules and optional drivers that must not be bundled.
  external: ["pg-native", "pino-pretty", "*.node"],
  // express and other CJS dependencies need these CJS globals after bundling.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import __nodePath from 'node:path';",
      "import __nodeUrl from 'node:url';",
      "globalThis.require = __createRequire(import.meta.url);",
      "globalThis.__filename = __nodeUrl.fileURLToPath(import.meta.url);",
      "globalThis.__dirname = __nodePath.dirname(globalThis.__filename);",
    ].join("\n"),
  },
});
