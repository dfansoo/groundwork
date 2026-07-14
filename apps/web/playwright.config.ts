import { defineConfig } from "@playwright/test";

/**
 * e2e runs against the REAL backend, not a mock — the point of these tests is to
 * prove the whole stack agrees: Next -> NextAuth -> NestJS -> Postgres.
 *
 * Before running: start the API and seed it.
 *   cd apps/backend && bun run db:seed && bun run dev
 */
export default defineConfig({
  testDir: "./e2e",
  // These flows write to a real database; running them in parallel makes them race.
  workers: 1,
  use: { baseURL: "http://localhost:3100" },
  webServer: [
    {
      command: "next dev -p 3100",
      port: 3100,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        API_URL: process.env.API_URL ?? "http://localhost:9000/v1",
        AUTH_SECRET: "test-secret-please-change",
        AUTH_URL: "http://localhost:3100",
        AUTH_EXCHANGE_SECRET: "local-auth-exchange-secret-please-change",
      },
    },
  ],
});
