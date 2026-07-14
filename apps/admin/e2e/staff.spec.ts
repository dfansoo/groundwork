import { test, expect, type Page } from "@playwright/test";

const ADMIN = { email: "admin@example.com", password: "ChangeMe123!" };

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Unique per run, so re-running the suite does not collide on the unique email. */
const newStaff = () => ({
  name: "Probe Person",
  email: `e2e-staff-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
  password: "ProbePass123!",
});

// The nav has always *shown* these links. Asserting they are visible is what let
// them point at pages that did not exist — so follow them.
test("the Staff nav entry leads to a page that exists", async ({ page }) => {
  await signIn(page);

  await page.getByRole("navigation").getByRole("link", { name: /staff/i }).click();

  await page.waitForURL(/\/staff$/);
  await expect(page.getByRole("heading", { name: /^staff$/i })).toBeVisible();
  await expect(page.getByRole("cell", { name: ADMIN.email })).toBeVisible();
});

test("add a staff member, change their roles, then revoke their access", async ({ page }) => {
  const person = newStaff();

  await signIn(page);
  await page.goto("/staff");

  // Add
  await page.getByRole("link", { name: /add staff/i }).click();
  await page.waitForURL(/\/staff\/new$/);
  await page.getByLabel(/^name$/i).fill(person.name);
  await page.getByLabel(/email/i).fill(person.email);
  await page.getByLabel(/temporary password/i).fill(person.password);
  await page.getByRole("checkbox", { name: "EDITOR", exact: true }).check();
  await page.getByRole("checkbox", { name: "VIEWER", exact: true }).uncheck();
  await page.getByRole("button", { name: /add staff member/i }).click();

  await page.waitForURL(/\/staff$/);
  const row = page.getByRole("row").filter({ hasText: person.email });
  await expect(row).toBeVisible();
  await expect(row.getByText("EDITOR")).toBeVisible();

  // Change roles
  await row.getByRole("button", { name: /edit roles/i }).click();
  await page.getByRole("checkbox", { name: "ADMIN", exact: true }).check();
  await page.getByRole("checkbox", { name: "EDITOR", exact: true }).uncheck();
  await page.getByRole("button", { name: /save roles/i }).click();

  const updated = page.getByRole("row").filter({ hasText: person.email });
  await expect(updated.getByText("ADMIN")).toBeVisible();
  await expect(updated.getByText("EDITOR")).toHaveCount(0);

  // Revoke — the account keeps existing, but loses every role, so it drops off
  // this list entirely.
  await updated.getByRole("button", { name: /revoke/i }).click();
  await page.getByRole("button", { name: /revoke access/i }).click();

  await expect(page.getByRole("row").filter({ hasText: person.email })).toHaveCount(0);
});

// Demoting the last SUPER_ADMIN cannot be undone from inside the product: no
// account would be left that can grant the role back.
test("refuses to demote the last SUPER_ADMIN", async ({ page }) => {
  await signIn(page);
  await page.goto("/staff");

  const self = page.getByRole("row").filter({ hasText: ADMIN.email });
  await self.getByRole("button", { name: /edit roles/i }).click();

  await page.getByRole("checkbox", { name: "SUPER_ADMIN", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "VIEWER", exact: true }).check();
  await page.getByRole("button", { name: /save roles/i }).click();

  await expect(page.getByText(/last super_admin/i)).toBeVisible();

  // And the role survived the attempt.
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: ADMIN.email }).getByText("SUPER_ADMIN"),
  ).toBeVisible();
});

test("refuses to let you revoke your own access", async ({ page }) => {
  await signIn(page);
  await page.goto("/staff");

  await page
    .getByRole("row")
    .filter({ hasText: ADMIN.email })
    .getByRole("button", { name: /revoke/i })
    .click();
  await page.getByRole("button", { name: /revoke access/i }).click();

  await expect(page.getByText(/cannot revoke your own access/i)).toBeVisible();
  await expect(page.getByRole("cell", { name: ADMIN.email })).toBeVisible();
});
