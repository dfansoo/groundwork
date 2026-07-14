import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "admin@example.com", password: "ChangeMe123!" };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("the Audit nav entry leads to a page that exists", async ({ page }) => {
  await signIn(page);

  await page.getByRole("navigation").getByRole("link", { name: /audit/i }).click();

  await page.waitForURL(/\/audit$/);
  await expect(page.getByRole("heading", { name: /audit log/i })).toBeVisible();
});

// The audit log is only worth anything if it actually records who did what. This
// drives a real mutation and then goes looking for it.
test("records a mutation against the account that made it", async ({ page }) => {
  const title = `E2E Audited ${Date.now()}`;

  await signIn(page);

  await page.goto("/items/new");
  await page.getByLabel(/title/i).fill(title);
  await page.getByRole("button", { name: /create item/i }).click();
  await page.waitForURL(/\/items$/);

  await page.goto("/audit");

  const row = page.getByRole("row").filter({ hasText: "create" }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText(ADMIN.email)).toBeVisible();
  await expect(row.getByText("Item")).toBeVisible();

  // Clean up the item the test created.
  await page.goto("/items");
  await page
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("button", { name: /delete/i })
    .click();
  await expect(page.getByRole("cell", { name: title })).toHaveCount(0);
});

test("filters by date and can be exported", async ({ page }) => {
  await signIn(page);
  await page.goto("/audit");

  // A window that ended before the log began has nothing in it.
  await page.getByLabel(/from date/i).fill("2000-01-01");
  await page.getByLabel(/to date/i).fill("2000-01-02");
  await expect(page.getByText(/no events match those filters/i)).toBeVisible();

  await page.getByLabel(/from date/i).fill("");
  await page.getByLabel(/to date/i).fill("");
  await expect(page.getByText(/no events match those filters/i)).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  expect((await download).suggestedFilename()).toBe("audit-events.csv");
});
