import { defineConfig, devices } from "@playwright/test";

/** Admin end-to-end tests against an isolated stack (see tests/stack.ts). Run after `npm run build`. */
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["line"]],
  use: { baseURL: `http://127.0.0.1:${process.env.E2E_ADMIN_PORT || 4400}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
