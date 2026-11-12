import { defineConfig } from "vitest/config";

// Testovi rade u Beogradskoj vremenskoj zoni, kao na Dušanovom računaru.
process.env.TZ = "Europe/Belgrade";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
  },
});
