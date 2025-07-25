import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    target: "safari15",
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
      "**\/*.server.test.ts?(x)",
    ],
    browser: {
      provider: "playwright",
      enabled: true,
      headless: true,
      instances: [
        {
          browser: "chromium",
          context: {
            permissions: [
              "storage-access",
            ],
          },
        },
      ],
    },
  },
});
