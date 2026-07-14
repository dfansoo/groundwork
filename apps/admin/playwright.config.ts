import { defineConfig } from "@playwright/test";

/**
 * e2e runs against the REAL backend. Start and seed it first:
 *   cd apps/backend && bun run db:seed && bun run dev
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: "http://localhost:3101" },
  webServer: [
    {
      command: "next dev -p 3101",
      port: 3101,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        API_URL: process.env.API_URL ?? "http://localhost:9000/v1",
        AUTH_SECRET: "test-secret-please-change",
        AUTH_URL: "http://localhost:3101",
        AUTH_EXCHANGE_SECRET: "local-auth-exchange-secret-please-change",
      },
    },
  ],
});
