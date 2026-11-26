import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the STATIC EXPORT, served exactly as a static host
 * would serve it (including the generated security headers / CSP).
 *
 *   npm run test:e2e:build   # builds ./out and ./out-fixtures
 *   npm run test:e2e
 */
/**
 * Ports and folders can be overridden (e.g. to test a fresh build while a preview keeps
 * serving ./out on 4173): E2E_WEB_PORT / E2E_WEB_DIR and E2E_FIXTURES_PORT / E2E_FIXTURES_DIR.
 */
const WEB_PORT = process.env.E2E_WEB_PORT || "4173";
const FIXTURES_PORT = process.env.E2E_FIXTURES_PORT || "4174";
const WEB_DIR = process.env.E2E_WEB_DIR || "out";
const FIXTURES_DIR = process.env.E2E_FIXTURES_DIR || "out-fixtures";

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
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `node scripts/serve-static.mjs ${WEB_DIR} ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node scripts/serve-static.mjs ${FIXTURES_DIR} ${FIXTURES_PORT}`,
      url: `http://127.0.0.1:${FIXTURES_PORT}/`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
