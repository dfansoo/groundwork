import { test, expect } from "@playwright/test";

const ADMIN = { email: "admin@example.com", password: "ChangeMe123!" };

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("the console is private", async ({ page }) => {
  await page.goto("/items");

  await expect(page).toHaveURL(/\/login/);
});

test("SUPER_ADMIN sees every permission-gated nav entry", async ({ page }) => {
  await signIn(page);

  const nav = page.getByRole("navigation");
  await expect(nav.getByRole("link", { name: /items/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /staff/i })).toBeVisible();
  await expect(nav.getByRole("link", { name: /audit/i })).toBeVisible();
});

test("create, see, edit and delete an item", async ({ page }) => {
  const title = `E2E Item ${Date.now()}`;
  const renamed = `${title} renamed`;

  await signIn(page);

  // Create
  await page.goto("/items/new");
  await page.getByLabel(/title/i).fill(title);
  await page.getByLabel(/description/i).fill("created by the admin e2e run");
  await page.getByRole("button", { name: /create item/i }).click();
  await page.waitForURL(/\/items$/);
  await expect(page.getByRole("cell", { name: title })).toBeVisible();

  // It starts as a draft
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row.getByText(/draft/i)).toBeVisible();

  // Edit
  await row.getByRole("link", { name: /edit/i }).click();
  await page.getByLabel(/title/i).fill(renamed);
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.waitForURL(/\/items$/);
  await expect(page.getByRole("cell", { name: renamed })).toBeVisible();

  // Delete
  await page
    .getByRole("row")
    .filter({ hasText: renamed })
    .getByRole("button", { name: /delete/i })
    .click();
  await expect(page.getByRole("cell", { name: renamed })).toHaveCount(0);
});
