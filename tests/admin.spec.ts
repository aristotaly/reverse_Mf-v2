import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

function runSeed(mode: "default" | "ewma" | "gap" = "default") {
  execSync(`npx tsx prisma/seed-test.ts ${mode}`, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
    },
  });
}

async function login(
  page: import("@playwright/test").Page,
  username: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByTestId("username-input").fill(username);
  await page.getByTestId("password-input").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/weight-trend");
}

test.describe("Admin user management", () => {
  test.beforeEach(() => runSeed("default"));

  test("admin sees Manage users link and can open /admin", async ({ page }) => {
    await login(page, "admin", "1234");

    const adminLink = page.getByTestId("admin-link");
    await expect(adminLink).toBeVisible();
    await adminLink.click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("user-row-admin")).toBeVisible();
  });

  test("admin can create a new user; new user can log in", async ({ page }) => {
    await login(page, "admin", "1234");
    await page.goto("/admin");

    await page.getByTestId("add-user-button").click();
    await page.getByTestId("new-username-input").fill("alice");
    await page.getByTestId("new-name-input").fill("Alice Example");
    await page.getByTestId("new-password-input").fill("hunter22");
    await page.getByTestId("create-user-submit").click();

    await expect(page.getByTestId("user-row-alice")).toBeVisible();

    // Sign out and sign in as the new user.
    await page.goto("/logout");
    await page.waitForURL("**/login");

    await page.getByTestId("username-input").fill("alice");
    await page.getByTestId("password-input").fill("hunter22");
    await page.getByTestId("login-submit").click();
    await page.waitForURL("**/weight-trend");

    // Alice is NOT an admin, so she shouldn't see the admin link...
    await expect(page.getByTestId("admin-link")).toHaveCount(0);
    // ...and direct navigation should bounce her back to the dashboard.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/weight-trend(\?|$)/);
  });

  test("admin can reset another user's password and they can log in with it", async ({
    page,
  }) => {
    await login(page, "admin", "1234");
    await page.goto("/admin");

    await page.getByTestId("add-user-button").click();
    await page.getByTestId("new-username-input").fill("bob");
    await page.getByTestId("new-name-input").fill("Bob");
    await page.getByTestId("new-password-input").fill("initial1");
    await page.getByTestId("create-user-submit").click();
    await expect(page.getByTestId("user-row-bob")).toBeVisible();

    await page.getByTestId("reset-password-bob").click();
    await page.getByTestId("reset-password-input").fill("newpass99");
    await page.getByTestId("reset-password-submit").click();

    await page.goto("/logout");
    await page.waitForURL("**/login");
    await page.getByTestId("username-input").fill("bob");
    await page.getByTestId("password-input").fill("newpass99");
    await page.getByTestId("login-submit").click();
    await page.waitForURL("**/weight-trend");
  });

  test("admin can promote a user and they get the admin link", async ({
    page,
  }) => {
    await login(page, "admin", "1234");
    await page.goto("/admin");

    await page.getByTestId("add-user-button").click();
    await page.getByTestId("new-username-input").fill("carol");
    await page.getByTestId("new-name-input").fill("Carol");
    await page.getByTestId("new-password-input").fill("carolpw1");
    await page.getByTestId("create-user-submit").click();
    await expect(page.getByTestId("user-row-carol")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByTestId("toggle-role-carol").click();
    await expect(page.getByTestId("user-row-carol")).toContainText(/admin/i);

    await page.goto("/logout");
    await page.waitForURL("**/login");
    await page.getByTestId("username-input").fill("carol");
    await page.getByTestId("password-input").fill("carolpw1");
    await page.getByTestId("login-submit").click();
    await page.waitForURL("**/weight-trend");

    await expect(page.getByTestId("admin-link")).toBeVisible();
  });

  test("admin cannot delete or demote themselves", async ({ page }) => {
    await login(page, "admin", "1234");
    await page.goto("/admin");

    await expect(page.getByTestId("delete-user-admin")).toBeDisabled();
    await expect(page.getByTestId("toggle-role-admin")).toBeDisabled();
  });

  test("admin can delete another user (cascade removes their entries)", async ({
    page,
  }) => {
    await login(page, "admin", "1234");
    await page.goto("/admin");

    await page.getByTestId("add-user-button").click();
    await page.getByTestId("new-username-input").fill("dan");
    await page.getByTestId("new-name-input").fill("Dan");
    await page.getByTestId("new-password-input").fill("danpw123");
    await page.getByTestId("create-user-submit").click();
    await expect(page.getByTestId("user-row-dan")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByTestId("delete-user-dan").click();

    await expect(page.getByTestId("user-row-dan")).toHaveCount(0);
  });
});
