import { test, expect } from "@playwright/test";

test.describe("Authentication flows", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/be fit era|login/i);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /log in|sign in/i })).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("notauser@fake.com");
    await page.getByLabel(/password/i).fill("WrongPass123!");
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    // Should stay on login and show an error message
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText(/invalid|incorrect|wrong|not found/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("signup page renders all fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test("forgot password page accepts email", async ({ page }) => {
    await page.goto("/forgot-password");
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
    await emailInput.fill("test@example.com");
    await page.getByRole("button", { name: /send|reset/i }).click();
    // Should show success or rate-limit message
    await expect(
      page.getByText(/sent|check your|email|too many/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("unauthenticated user redirected from /profile", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user redirected from /settings", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
