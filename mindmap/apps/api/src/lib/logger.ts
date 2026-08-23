import pino from "pino";

// pino-pretty runs in a worker thread, which is unavailable in bundled
// serverless runtimes — keep it strictly opt-in for local development.
const usePretty = process.env.LOG_PRETTY === "1";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(usePretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
