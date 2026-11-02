import { defineConfig } from "@playwright/test";
import "./scripts/_env";

const PORT = 3100;
// Tests run against a disposable database named <your db>_e2e (created and reset automatically).
const base = process.env.DATABASE_URL ?? "postgres://crm:crm@localhost:5432/crm";
const e2eUrl =
  process.env.E2E_DATABASE_URL ??
  (() => {
    const u = new URL(base);
    u.pathname = `${u.pathname}_e2e`;
    return u.toString();
  })();

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run db:reset-test && npm run build && npm run start -- -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: !!process.env.PW_REUSE_SERVER,
    env: {
      DATABASE_URL: e2eUrl,
      E2E_DATABASE_URL: e2eUrl,
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: "e2e-admin-password-1",
      DEMO_USERS_PASSWORD: "e2e-demo-password-1",
      SEED_DEMO: "true",
      APP_TIMEZONE: "UTC",
      TZ: "UTC",
      BACKUP_DIR: "./data/e2e-backups",
    },
  },
});
