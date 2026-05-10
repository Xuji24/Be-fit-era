import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// ─── Area 6: Profile Page ─────────────────────────────────────────────────

test.describe("TC-P01 – TC-P03: Profile page (authenticated)", () => {
  test.skip(
    !process.env.E2E_RUNNER_EMAIL,
    "Skipped: set E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD to run profile tests"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "runner");
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");
  });

  // TC-P01: Update profile name and save
  test("TC-P01 updating First Name and Last Name saves successfully", async ({ page }) => {
    const firstNameInput = page.getByLabel(/first name/i);
    const lastNameInput = page.getByLabel(/last name/i);

    await expect(firstNameInput).toBeVisible({ timeout: 8_000 });
    await expect(lastNameInput).toBeVisible();

    // Update values
    await firstNameInput.fill("E2E");
    await lastNameInput.fill("Tester");

    await page.getByRole("button", { name: /save changes/i }).click();

    // Success toast or confirmation
    await expect(
      page.getByText(/saved|success|updated|changes saved/i)
    ).toBeVisible({ timeout: 8_000 });
    // Stays on /profile (no redirect)
    await expect(page).toHaveURL(/\/profile/);
  });

  // TC-P02: Email field is read-only
  test("TC-P02 email field is disabled and cannot be edited", async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible({ timeout: 8_000 });
    // Email input should be disabled
    await expect(emailInput).toBeDisabled();
  });

  // TC-P03: Update username and save
  test("TC-P03 updating Username field saves without redirecting", async ({ page }) => {
    const usernameInput = page.getByLabel(/username/i);
    await expect(usernameInput).toBeVisible({ timeout: 8_000 });
    await usernameInput.fill(`e2e_user_${Date.now()}`);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(
      page.getByText(/saved|success|updated|changes saved/i)
    ).toBeVisible({ timeout: 8_000 });
    // Stays on /profile
    await expect(page).toHaveURL(/\/profile/);
  });
});
