import { test, expect } from "@playwright/test";

// Requires the seeded database: one published item ("Hello World") and one draft
// ("Work In Progress").

test("lists published items and opens one", async ({ page }) => {
  await page.goto("/items");

  const published = page.getByRole("link", { name: /hello world/i });
  await expect(published).toBeVisible();

  await published.click();
  await expect(page.getByRole("heading", { level: 1, name: /hello world/i })).toBeVisible();
});

test("does not leak draft items to the public", async ({ page }) => {
  await page.goto("/items");

  await expect(page.getByText(/work in progress/i)).toHaveCount(0);
});

test("a draft's URL 404s for the public", async ({ page }) => {
  const res = await page.goto("/items/work-in-progress");

  expect(res?.status()).toBe(404);
});
