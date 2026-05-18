import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isRemote = /^https?:\/\//.test(baseURL) && !baseURL.includes("localhost");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Only start a local dev server when we're testing against localhost.
  // When targeting the deployed Vercel URL, we test the live app directly.
  webServer: isRemote
    ? undefined
    : {
        command: "npm run db:push:local && npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
        env: {
          DATABASE_URL: "file:./prisma/dev.db",
          SEED_PASSCODE: "1234",
          SEED_USER_NAME: "Me",
          SESSION_SECRET: "dev-secret-change-in-production",
        },
      },
});
