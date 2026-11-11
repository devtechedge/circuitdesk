import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3117);
const BASE_URL = `http://localhost:${PORT}`;

const authSecret =
  process.env.AUTH_SECRET ?? "e2e-circuitdesk-auth-secret-0123456789abcdef0123456789";
const encKey =
  process.env.ENCRYPTION_KEY ??
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const fileSecret =
  process.env.FILE_SIGNING_SECRET ?? "e2e-circuitdesk-file-secret-0123456789abcdef0123456789";
const webhookSecret =
  process.env.WEBHOOK_SIGNING_SECRET ?? "e2e-circuitdesk-wh-secret-0123456789abcdef0123456789ab";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      APP_URL: BASE_URL,
      AUTH_SECRET: authSecret,
      ENCRYPTION_KEY: encKey,
      FILE_SIGNING_SECRET: fileSecret,
      WEBHOOK_SIGNING_SECRET: webhookSecret,
      DEMO_MODE: "true",
      ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
    },
  },
});
