import { test, expect } from "@playwright/test";

/** A fresh address per run, so re-running the suite does not collide on the unique email. */
function newEmail(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

test("the account area is guarded from signed-out visitors", async ({ page }) => {
  await page.goto("/account");

  await expect(page).toHaveURL(/\/login/);
});

test("register, then land on the account page", async ({ page }) => {
  const email = newEmail();

  await page.goto("/register");
  await page.getByLabel(/^name$/i).fill("Probe User");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password$/i).fill("ProbePass123!");
  await page.getByRole("button", { name: /create account|sign up|register/i }).click();

  // The form signs the user in and redirects. Wait for that rather than racing it
  // with a manual navigation — at click time the session cookie is not set yet.
  await page.waitForURL(/\/account/);

  await expect(page.getByRole("heading", { name: /^account$/i })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});

test("sign in with the seeded admin and see the profile", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@example.com");
  await page.getByLabel(/password/i).fill("ChangeMe123!");
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/account/);

  // Fetched client-side through the BFF, which exercises the whole chain:
  // session cookie -> Next BFF route -> bearer token -> NestJS -> Postgres.
  await expect(page.getByText("admin@example.com")).toBeVisible();
});

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("admin@example.com");
  await page.getByLabel(/password/i).fill("WrongPassword123!");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
