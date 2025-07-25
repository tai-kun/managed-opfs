import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    target: "node22",
  },
  define: {
    __DEBUG__: ["DEBUG", "ACTIONS_RUNNER_DEBUG", "ACTIONS_STEP_DEBUG"]
      .some(k => ["1", "true"].includes(process.env[k]?.toLowerCase()!))
      .toString(),
  },
  test: {
    include: [
      "**\/*.test.ts?(x)",
    ],
    exclude: [
      "**\/*.client.test.ts?(x)",
    ],
  },
});
