import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "vitest/config";

loadEnvConfig(process.cwd(), true);

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // The real module throws outside a React Server Components build.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    env: {
      // Tests never touch the network or the development database.
      TMDB_FAKE: "1",
      // Never fall back to DATABASE_URL: database tests wipe tables.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://test-database-not-set.invalid/none",
    },
    // Database tests share one schema, so files run one at a time.
    fileParallelism: false,
  },
});
