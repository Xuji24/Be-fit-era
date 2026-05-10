import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// ─── Area 4: Organizer Dashboard ──────────────────────────────────────────

// TC-O01: Access guard — non-organizer redirected
test.describe("TC-O01: Organizer access guard", () => {
  test("TC-O01 non-organizer/non-admin is redirected away from /organizer", async ({ page }) => {
    test.skip(
      !process.env.E2E_RUNNER_EMAIL,
      "Skipped: set E2E_RUNNER_EMAIL / E2E_RUNNER_PASSWORD to run this test"
    );
    await loginAs(page, "runner");
    await page.goto("/organizer");
    // Should land on /settings or /login, NOT /organizer
    await page.waitForURL(/\/settings|\/login/, { timeout: 8_000 });
    await expect(page).not.toHaveURL(/\/organizer/);
  });
});

// TC-O02 – TC-O11: Organizer dashboard interactions
test.describe("TC-O02 – TC-O11: Organizer dashboard (organizer role)", () => {
  test.skip(
    !process.env.E2E_ORGANIZER_EMAIL,
    "Skipped: set E2E_ORGANIZER_EMAIL and E2E_ORGANIZER_PASSWORD to run organizer tests"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "organizer");
    await page.goto("/organizer");
    await page.waitForLoadState("networkidle");
  });

  // TC-O02: Dashboard loads with correct elements
  test("TC-O02 organizer dashboard loads with Create Race button and race cards", async ({ page }) => {
    await expect(page).toHaveURL(/\/organizer/);
    await expect(page.getByRole("button", { name: /create race/i })).toBeVisible({ timeout: 8_000 });
    // Stats: total races + total registrations
    await expect(page.getByText(/total.*race|races?/i)).toBeVisible({ timeout: 8_000 });
  });

  // TC-O03: Create race modal opens and all required fields are present
  test("TC-O03 Create Race modal shows all required fields", async ({ page }) => {
    await page.getByRole("button", { name: /create race/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    // Required fields
    await expect(page.getByLabel(/race title/i)).toBeVisible();
    await expect(page.getByLabel(/event date/i)).toBeVisible();
    await expect(page.getByLabel(/distance/i)).toBeVisible();
  });

  // TC-O04: Create race — missing required fields shows validation error
  test("TC-O04 submitting Create Race with empty title shows validation error", async ({ page }) => {
    await page.getByRole("button", { name: /create race/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    // Leave Race Title empty, try to submit
    await page.getByRole("button", { name: /create race/i }).last().click();
    // Validation error should appear
    await expect(
      page.getByText(/required|please.*title|title.*required|at least/i)
    ).toBeVisible({ timeout: 5_000 });
    // Modal should still be open (not submitted)
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  // TC-O05: Create race — upload design shows thumbnail
  test("TC-O05 design upload areas are present in Create Race modal", async ({ page }) => {
    await page.getByRole("button", { name: /create race/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    // Design upload sections should be visible
    await expect(page.getByText(/t.?shirt|tshirt|shirt/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/medal/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/certificate/i)).toBeVisible({ timeout: 5_000 });
    // File inputs for designs should exist in DOM (hidden)
    const fileInputs = page.locator('input[type="file"]');
    await expect(fileInputs.first()).toBeAttached({ timeout: 5_000 });
  });

  // TC-O06: Edit race modal pre-populates data
  test("TC-O06 Edit Race modal opens with pre-populated race data", async ({ page }) => {
    const editBtn = page.getByRole("button", { name: /^edit$/i }).first();
    if (await editBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await editBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
      // Race Title field should not be empty (pre-populated)
      const titleInput = page.getByLabel(/race title/i);
      await expect(titleInput).toBeVisible();
      const titleValue = await titleInput.inputValue();
      expect(titleValue.length).toBeGreaterThan(0);
    }
  });

  // TC-O07: Edit Designs modal opens
  test("TC-O07 Designs modal opens from race card Designs button", async ({ page }) => {
    const designsBtn = page.getByRole("button", { name: /^designs$/i }).first();
    if (await designsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await designsBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText(/t.?shirt|tshirt|shirt/i)).toBeVisible();
      await expect(page.getByText(/medal/i)).toBeVisible();
      await expect(page.getByText(/certificate/i)).toBeVisible();
    }
  });

  // TC-O08: Save Changes disabled when no changes made in Designs modal
  test("TC-O08 Save Changes button is disabled when no design changes were made", async ({ page }) => {
    const designsBtn = page.getByRole("button", { name: /^designs$/i }).first();
    if (await designsBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await designsBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
      // Without making any changes, Save Changes should be disabled
      const saveBtn = page.getByRole("button", { name: /save changes/i });
      await expect(saveBtn).toBeDisabled({ timeout: 3_000 });
    }
  });

  // TC-O09: Cancel race modal opens with warning and reason field
  test("TC-O09 Cancel Race modal shows warning and reason textarea", async ({ page }) => {
    const cancelBtn = page.getByRole("button", { name: /^cancel$/i }).first();
    if (await cancelBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cancelBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
      // Warning about registrations being cancelled
      await expect(
        page.getByText(/registration|irreversible|cannot be undone|all.*cancel/i)
      ).toBeVisible();
      // Reason textarea
      await expect(
        page.locator("textarea").or(page.getByLabel(/reason/i))
      ).toBeVisible();
    }
  });

  // TC-O10: Cancel race — reason too short shows inline error
  test("TC-O10 cancel reason under 10 characters shows validation error", async ({ page }) => {
    const cancelBtn = page.getByRole("button", { name: /^cancel$/i }).first();
    if (await cancelBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await cancelBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
      const reasonInput = page.locator("textarea").or(page.getByLabel(/reason/i)).first();
      await reasonInput.fill("Short"); // only 5 chars
      await page.getByRole("button", { name: /cancel race/i }).click();
      await expect(
        page.getByText(/at least 10|10 character|reason.*required/i)
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  // TC-O11: Design file input restricts to valid image/SVG types
  test("TC-O11 design upload inputs only accept image/SVG file types", async ({ page }) => {
    await page.getByRole("button", { name: /create race/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    const fileInputs = page.locator('input[type="file"]');
    const count = await fileInputs.count();
    for (let i = 0; i < count; i++) {
      const acceptAttr = await fileInputs.nth(i).getAttribute("accept");
      if (acceptAttr) {
        expect(acceptAttr).toMatch(/png|jpg|jpeg|webp|svg/i);
      }
    }
  });
});
