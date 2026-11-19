import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the STATIC EXPORT, served exactly as a static host
 * would serve it (including the generated security headers / CSP).
 *
 *   npm run test:e2e:build   # builds ./out and ./out-fixtures
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The homepage runs several WebGL scenes, which headless Chromium renders in
  // software (no GPU). Fewer parallel browsers keeps runs stable.
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node scripts/serve-static.mjs out 4173",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node scripts/serve-static.mjs out-fixtures 4174",
      url: "http://127.0.0.1:4174/",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
