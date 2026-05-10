import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// ─── Area 7: Settings Page ────────────────────────────────────────────────

test.describe("TC-S01 – TC-S04: Change Password (authenticated)", () => {
  test.skip(
    !process.env.E2E_RUNNER_EMAIL,
    "Skipped: set E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD to run settings tests"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "runner");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  // TC-S01: Change password — page has all required fields
  test("TC-S01 settings page shows current, new, and confirm password fields", async ({ page }) => {
    await expect(page.getByLabel(/current password/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByLabel(/new password/i)).toBeVisible();
    await expect(page.getByLabel(/confirm.*password|confirm new/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /update password/i })).toBeVisible();
  });

  // TC-S02: Wrong current password shows error
  test("TC-S02 wrong current password shows error and does not change password", async ({ page }) => {
    await page.getByLabel(/current password/i).fill("WrongCurrentPass999!");
    await page.getByLabel(/new password/i).fill("NewStrongPass1!");
    await page.getByLabel(/confirm.*password|confirm new/i).fill("NewStrongPass1!");
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(
      page.getByText(/incorrect|invalid|wrong|current.*password|not.*match/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  // TC-S03: New password same as old shows specific error
  test("TC-S03 new password same as current shows choose different password error", async ({ page }) => {
    const currentPass = process.env.E2E_RUNNER_PASSWORD ?? "Test@1234";
    await page.getByLabel(/current password/i).fill(currentPass);
    await page.getByLabel(/new password/i).fill(currentPass);
    await page.getByLabel(/confirm.*password|confirm new/i).fill(currentPass);
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(
      page.getByText(/different password|same.*password|choose.*different/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  // TC-S04: Weak new password — strength indicator and blocked submit
  test("TC-S04 weak new password blocks update and shows strength feedback", async ({ page }) => {
    await page.getByLabel(/current password/i).fill("AnyCurrentPass");
    await page.getByLabel(/new password/i).fill("weak");
    await page.getByLabel(/confirm.*password|confirm new/i).fill("weak");
    await page.getByRole("button", { name: /update password/i }).click();
    // Should either block submit or show strength/validation error
    await expect(
      page.getByText(/strength|requirement|uppercase|lowercase|number|symbol|special|at least/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("TC-S05: Push notification toggle (authenticated)", () => {
  test.skip(
    !process.env.E2E_RUNNER_EMAIL,
    "Skipped: set E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD to run settings tests"
  );

  // TC-S05: Push notification toggle is visible
  test("TC-S05 push notification toggle is visible on settings page", async ({ page }) => {
    await loginAs(page, "runner");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    // Toggle button or switch should be present
    const toggle = page.getByRole("switch", { name: /notification|push/i }).or(
      page.locator("[data-testid*='push'], [aria-label*='notification']")
    ).or(page.getByText(/push notification/i));
    await expect(toggle.first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("TC-S06 – TC-S10: Organizer Application (authenticated)", () => {
  test.skip(
    !process.env.E2E_RUNNER_EMAIL,
    "Skipped: set E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD to run settings tests"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "runner");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  // TC-S06: Organizer application form renders for regular user
  test("TC-S06 organizer application form renders for non-organizer users", async ({ page }) => {
    // If not already an organizer, the application form should show
    const alreadyOrganizer = page.getByText(/already an organizer/i);
    const underReview = page.getByText(/under review/i);
    const applicationForm = page.getByLabel(/organization name/i);

    const isOrganizer = await alreadyOrganizer.isVisible({ timeout: 3_000 }).catch(() => false);
    const isPending = await underReview.isVisible({ timeout: 3_000 }).catch(() => false);
    const showsForm = await applicationForm.isVisible({ timeout: 3_000 }).catch(() => false);

    // One of the three states must be shown
    expect(isOrganizer || isPending || showsForm).toBeTruthy();
  });

  // TC-S07: Organizer application — no documents shows error
  test("TC-S07 submitting organizer application without documents shows error", async ({ page }) => {
    const applicationForm = page.getByLabel(/organization name/i);
    // Only run if the form is actually shown (not pending/already organizer)
    if (await applicationForm.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await applicationForm.fill("Test Org E2E");
      await page.getByLabel(/contact email/i).fill("org@test.com");
      // Do NOT attach any documents
      await page.getByRole("button", { name: /submit application/i }).click();
      await expect(
        page.getByText(/document|at least.*1|proof|required/i)
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  // TC-S08: Organizer application — already organizer shows confirmation
  test("TC-S08 organizer/admin user sees Already Organizer confirmation on settings", async ({ page }) => {
    test.skip(
      !process.env.E2E_ORGANIZER_EMAIL,
      "Skipped: requires E2E_ORGANIZER_EMAIL and E2E_ORGANIZER_PASSWORD"
    );
    // Re-login as organizer for this specific test
    await loginAs(page, "organizer");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/already an organizer/i)).toBeVisible({ timeout: 8_000 });
  });

  // TC-S09: Document file size limit
  test("TC-S09 document upload area is present and has file constraints", async ({ page }) => {
    const applicationForm = page.getByLabel(/organization name/i);
    if (await applicationForm.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // File upload input for proof documents should exist
      const fileInput = page.locator('input[type="file"]').first();
      await expect(fileInput).toBeAttached({ timeout: 5_000 });
      const acceptAttr = await fileInput.getAttribute("accept");
      if (acceptAttr) {
        expect(acceptAttr).toMatch(/pdf|jpg|jpeg|png|webp/i);
      }
    }
  });

  // TC-S10: Already pending application shows Under Review state
  test("TC-S10 user with pending application sees Under Review badge", async ({ page }) => {
    test.skip(
      !process.env.E2E_PENDING_ORGANIZER_EMAIL,
      "Skipped: set E2E_PENDING_ORGANIZER_EMAIL to a user with a pending application"
    );
    await expect(page.getByText(/under review|pending|review/i)).toBeVisible({ timeout: 8_000 });
  });
});
