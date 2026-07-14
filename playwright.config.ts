import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Player rendering / legacy WebView compatibility tests.
 *
 * Run locally:
 *   npm run dev            # starts Vite on :8080
 *   npm run test:e2e       # runs the specs against http://localhost:8080
 *
 * CI: set PLAYWRIGHT_BASE_URL to override the target origin.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
    viewport: { width: 1280, height: 1800 },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Allow overriding Chromium path (useful in CI / sandboxes where a
        // system Chromium is preinstalled and `playwright install` is skipped).
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
          : undefined,
      },
    },
  ],
});
