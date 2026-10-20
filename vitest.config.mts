import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts", "evals/**/*.test.ts"],
    // Workflow tests replay whole agent runs; under a full parallel run they
    // can pass 5s (the default) on a busy machine.
    testTimeout: 20_000,
  },
});
