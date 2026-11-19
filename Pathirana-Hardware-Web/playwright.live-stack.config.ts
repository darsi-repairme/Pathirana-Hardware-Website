import { defineConfig, devices } from "@playwright/test";
import { LIVE_SITE_PORT } from "./tests/live-stack/ports.mjs";

/**
 * REAL end-to-end tests: website (./out-live) → website API → throwaway
 * PostgreSQL, all started by tests/live-stack/global-setup.ts.
 *
 *   (Backend) npm run build
 *   npm run test:live-stack
 */
export default defineConfig({
  testDir: "./tests/live-stack",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/live-stack/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${LIVE_SITE_PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
