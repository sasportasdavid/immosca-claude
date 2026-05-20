// Charge Sentry au boot du worker (side effect import). Init no-op si
// SENTRY_DSN_WORKER absente — utile pour dev local sans Sentry configuré.
import "./src/lib/sentry";

import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID ?? "proj_placeholder",
  runtime: "node",
  logLevel: "log",
  maxDuration: 600, // 10 min max par task
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 30_000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger", "./src/value"],
});
