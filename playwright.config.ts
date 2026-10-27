import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a PRODUCTION build (`npm run build` first) on port 3100,
// backed by a fresh in-memory PGlite database on 54400 seeded with dev fixtures.
// Dev sign-in is enabled for this local run only via RESTIX_LOCAL_PROD_TEST=1.
const DB_PORT = 54400;
const APP_PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    // Uses the installed Chrome rather than downloading a browser.
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: "npx tsx scripts/local-db.ts --memory",
      env: { LOCAL_DB_PORT: String(DB_PORT) },
      port: DB_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/sign-in`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
        // PGlite is a single session behind the socket; one pooled connection keeps concurrent
        // transactions from interleaving there (real Postgres doesn't need this).
        DB_POOL_MAX: "1",
        APP_URL: `http://localhost:${APP_PORT}`,
        AUTH_MODE: "dev",
        RESTIX_LOCAL_PROD_TEST: "1",
        DEV_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123",
        ALLOWED_EMAIL_DOMAINS: "snu.edu.in",
        DEFAULT_COLLEGE_SLUG: "snu",
        CRON_SECRET: "e2e-cron-secret-0123456789",
      },
    },
  ],
});
