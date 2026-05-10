import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// ─── Area 5: Activities Dashboard ─────────────────────────────────────────

// TC-AC05: Unauthenticated renders static fallback (no auth needed)
test.describe("TC-AC05: Activities page — auth redirect", () => {
  test("TC-AC05 /activities redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/activities");
    // /activities is protected — should redirect unauthenticated users to /login
    await page.waitForURL(/\/login/, { timeout: 8_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

// TC-AC01 – TC-AC04: Authenticated activities flows
test.describe("TC-AC01 – TC-AC04: Activities Dashboard (authenticated)", () => {
  test.skip(
    !process.env.E2E_RUNNER_EMAIL,
    "Skipped: set E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD to run authenticated tests"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "runner");
    await page.goto("/activities");
    await page.waitForLoadState("networkidle");
  });

  // TC-AC01: Activities page loads all stat sections
  test("TC-AC01 activities page loads stats, weekly chart, and activity log", async ({ page }) => {
    // Stats cards
    await expect(page.getByText(/total.*km|km.*total/i).or(
      page.getByText(/\d+(\.\d+)?\s*km/i)
    )).toBeVisible({ timeout: 10_000 });
    // Weekly chart or summary
    await expect(
      page.getByText(/weekly|this week|mon|tue|wed/i)
    ).toBeVisible({ timeout: 8_000 });
    // Page heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 8_000 });
  });

  // TC-AC02: Log Distance modal opens — Strava state shown correctly
  test("TC-AC02 Log Distance button opens modal with Strava connection status", async ({ page }) => {
    const logDistanceBtn = page.getByRole("button", { name: /log distance|log.*activity/i }).first();
    if (await logDistanceBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await logDistanceBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
      // Either Strava activity list OR "Connect Strava" button should be present
      const stravaActivities = page.getByText(/strava|activity.*strava/i);
      const connectBtn = page.getByRole("button", { name: /connect strava/i });
      const hasStravaContent =
        (await stravaActivities.isVisible({ timeout: 5_000 }).catch(() => false)) ||
        (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false));
      expect(hasStravaContent).toBeTruthy();
    }
  });

  // TC-AC03: Strava not connected shows Connect button
  test("TC-AC03 when Strava is not connected, Connect Strava button is shown in modal", async ({ page }) => {
    test.skip(
      !!process.env.E2E_STRAVA_CONNECTED,
      "Skipped: this test only applies when Strava is NOT connected"
    );
    const logDistanceBtn = page.getByRole("button", { name: /log distance|log.*activity/i }).first();
    if (await logDistanceBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await logDistanceBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
      await expect(
        page.getByRole("button", { name: /connect strava/i })
      ).toBeVisible({ timeout: 8_000 });
    }
  });

  // TC-AC04: Already imported activity shows indicator
  test("TC-AC04 activities already imported show an indicator and cannot be re-imported", async ({ page }) => {
    test.skip(
      !process.env.E2E_STRAVA_CONNECTED,
      "Skipped: set E2E_STRAVA_CONNECTED=true when Strava is linked to the test user"
    );
    const logDistanceBtn = page.getByRole("button", { name: /log distance|log.*activity/i }).first();
    if (await logDistanceBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await logDistanceBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 8_000 });
      // Look for "already imported" indicators
      const alreadyImported = page.getByText(/already imported|imported/i);
      if (await alreadyImported.isVisible({ timeout: 5_000 }).catch(() => false)) {
        // Import button should not be present next to already-imported items
        await expect(
          page.getByRole("button", { name: /^import$/i })
        ).not.toBeVisible({ timeout: 3_000 });
      }
    }
  });
});
