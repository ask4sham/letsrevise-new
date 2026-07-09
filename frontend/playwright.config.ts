import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 4C — Browser smoke.
 * Default: http://localhost:3000 (start frontend separately).
 * Override: SMOKE_BASE_URL=https://letsrevise.com
 */
const baseURL = process.env.SMOKE_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "e2e/smoke-results.json" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  timeout: 60_000,
});
