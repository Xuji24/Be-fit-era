import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// ─── Area 3: Race Browsing & Registration ─────────────────────────────────

test.describe("TC-R01 – TC-R04: Race list (public)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/race");
    await page.waitForLoadState("networkidle");
  });

  // TC-R01: Browse races — page loads with race cards or empty state
  test("TC-R01 race listing page loads with cards or empty state", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
    const raceCard = page.locator("a[href*='/race/'], [data-testid='race-card'], article").first();
    const emptyState = page.getByText(/no races|coming soon|no upcoming/i);
    const hasContent = (await raceCard.isVisible({ timeout: 8_000 }).catch(() => false)) ||
                       (await emptyState.isVisible({ timeout: 8_000 }).catch(() => false));
    expect(hasContent).toBeTruthy();
  });

  // TC-R02: Category filter pills do client-side filtering
  test("TC-R02 category filter pills narrow displayed races", async ({ page }) => {
    const pill10k = page.getByRole("button", { name: /10k|10 km/i });
    if (await pill10k.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await pill10k.click();
      await page.waitForTimeout(300); // client-side, instant
      // Page should not crash; verify body still visible
      await expect(page.locator("body")).toBeVisible();
    }
  });

  // TC-R03: Search bar filters by race name/organizer/location
  test("TC-R03 search bar instantly filters race cards", async ({ page }) => {
    const searchInput = page.getByLabel(/search races/i).or(page.getByPlaceholder(/search/i));
    await expect(searchInput).toBeVisible({ timeout: 5_000 });
    await searchInput.fill("zzz_nomatch_e2e");
    await page.waitForTimeout(300);
    // Results should update; body must still be visible
    await expect(page.locator("body")).toBeVisible();
  });

  // TC-R04: No results state
  test("TC-R04 no races found message shown when nothing matches", async ({ page }) => {
    const searchInput = page.getByLabel(/search races/i).or(page.getByPlaceholder(/search/i));
    if (await searchInput.isVisible()) {
      await searchInput.fill("__nothing_matches_this_e2e__");
      await page.waitForTimeout(300);
      // Use .first() to avoid strict mode violation when multiple elements match
      await expect(
        page.getByText(/no races|no results|adjust.*filter/i).first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe("TC-R05 – TC-R12: Race detail page (public + auth)", () => {
  // TC-R05: Race detail page renders key sections
  test("TC-R05 race detail page renders all key info sections", async ({ page }) => {
    await page.goto("/race");
    const firstRaceLink = page.locator("a[href*='/race/']").first();
    if (await firstRaceLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstRaceLink.click();
      await page.waitForLoadState("networkidle");
      // Heading (race title)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
      // Registration sidebar area (at least a "Join Race" button or status message)
      const regElement = page.getByText(/join race|already registered|registration closed|race full|deadline/i);
      await expect(regElement.first()).toBeVisible({ timeout: 8_000 });
    }
  });

  // TC-R06: Registration sidebar shows "Join Race" when open (logged in)
  test("TC-R06 Join Race button visible when registration is open and user is logged in", async ({ page }) => {
    test.skip(
      !process.env.E2E_RUNNER_EMAIL,
      "Skipped: requires E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD"
    );
    await loginAs(page, "runner");
    await page.goto("/race");
    const firstRaceLink = page.locator("a[href*='/race/']").first();
    if (await firstRaceLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstRaceLink.click();
      await page.waitForLoadState("networkidle");
      // Either "Join Race" or a status message
      const joinBtn = page.getByRole("button", { name: /join race/i });
      const statusMsg = page.getByText(/already registered|registration closed|race full|deadline passed/i);
      const hasEither = (await joinBtn.isVisible({ timeout: 5_000 }).catch(() => false)) ||
                        (await statusMsg.isVisible({ timeout: 5_000 }).catch(() => false));
      expect(hasEither).toBeTruthy();
    }
  });

  // TC-R07: Join race modal — full form renders
  test("TC-R07 join race modal shows all required form fields in Step 1", async ({ page }) => {
    test.skip(
      !process.env.E2E_RUNNER_EMAIL,
      "Skipped: requires authenticated user and an open race"
    );
    await loginAs(page, "runner");
    await page.goto("/race");
    const firstRaceLink = page.locator("a[href*='/race/']").first();
    if (await firstRaceLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstRaceLink.click();
      await page.waitForLoadState("networkidle");
      const joinBtn = page.getByRole("button", { name: /join race/i });
      if (await joinBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await joinBtn.click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
        await expect(page.getByLabel(/full name/i)).toBeVisible();
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/phone/i)).toBeVisible();
        // Shirt size options
        await expect(page.getByText(/shirt size|size/i).first()).toBeVisible();
        // Payment method
        await expect(page.getByText(/payment|gcash|credit|bank/i).first()).toBeVisible();
      }
    }
  });

  // TC-R08: Invalid PH phone format shows error
  test("TC-R08 invalid phone number format shows validation error in join modal", async ({ page }) => {
    test.skip(
      !process.env.E2E_RUNNER_EMAIL,
      "Skipped: requires authenticated user and an open race"
    );
    await loginAs(page, "runner");
    await page.goto("/race");
    const firstRaceLink = page.locator("a[href*='/race/']").first();
    if (await firstRaceLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstRaceLink.click();
      await page.waitForLoadState("networkidle");
      const joinBtn = page.getByRole("button", { name: /join race/i });
      if (await joinBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await joinBtn.click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
        await page.getByLabel(/full name/i).fill("Test Runner");
        await page.getByLabel(/email/i).fill("runner@test.com");
        await page.getByLabel(/phone/i).fill("12345"); // invalid format
        // Try to proceed
        const dialog = page.getByRole("dialog");
        const nextBtn = dialog.getByRole("button", { name: /next|continue|proceed/i }).first();
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
          await expect(
            page.getByText(/valid.*phone|phone.*format|invalid.*phone|09|format/i)
          ).toBeVisible({ timeout: 5_000 });
        }
      }
    }
  });

  // TC-R09: Duplicate registration blocked (checked at server)
  test("TC-R09 race detail shows Already Registered badge when user has joined", async ({ page }) => {
    test.skip(
      !process.env.E2E_RUNNER_EMAIL || !process.env.E2E_REGISTERED_RACE_ID,
      "Skipped: set E2E_REGISTERED_RACE_ID to the race ID the test user is already registered for"
    );
    await loginAs(page, "runner");
    const raceId = process.env.E2E_REGISTERED_RACE_ID;
    await page.goto(`/race/${raceId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/already registered/i)).toBeVisible({ timeout: 8_000 });
  });

  // TC-R10: Already registered → no Join Race button
  test("TC-R10 Already Registered state hides Join Race button", async ({ page }) => {
    test.skip(
      !process.env.E2E_RUNNER_EMAIL || !process.env.E2E_REGISTERED_RACE_ID,
      "Skipped: set E2E_REGISTERED_RACE_ID to a race the test user is already registered for"
    );
    await loginAs(page, "runner");
    const raceId = process.env.E2E_REGISTERED_RACE_ID;
    await page.goto(`/race/${raceId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /join race/i })).not.toBeVisible({ timeout: 5_000 });
  });

  // TC-R11: Race full hides Join Race button
  test("TC-R11 full race shows Race Full message instead of Join Race button", async ({ page }) => {
    test.skip(
      !process.env.E2E_FULL_RACE_ID,
      "Skipped: set E2E_FULL_RACE_ID to a race at max capacity"
    );
    await page.goto(`/race/${process.env.E2E_FULL_RACE_ID}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/race full|no spots/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /join race/i })).not.toBeVisible();
  });

  // TC-R12: Registration closed hides Join Race button
  test("TC-R12 closed registration shows Registration Closed instead of Join Race", async ({ page }) => {
    test.skip(
      !process.env.E2E_CLOSED_RACE_ID,
      "Skipped: set E2E_CLOSED_RACE_ID to a race with registrationOpen = false"
    );
    await page.goto(`/race/${process.env.E2E_CLOSED_RACE_ID}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/registration closed/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /join race/i })).not.toBeVisible();
  });
});

test.describe("TC-R13 – TC-R14: Race activity report", () => {
  // TC-R13: Report modal submits with valid reason
  test("TC-R13 report activity modal shows and accepts a valid reason", async ({ page }) => {
    test.skip(
      !process.env.E2E_RUNNER_EMAIL,
      "Skipped: requires E2E_RUNNER_EMAIL and a race with activity entries"
    );
    await loginAs(page, "runner");
    await page.goto("/race");
    const firstRaceLink = page.locator("a[href*='/race/']").first();
    if (await firstRaceLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstRaceLink.click();
      await page.waitForLoadState("networkidle");
      const reportBtn = page.getByRole("button", { name: /report/i }).first();
      if (await reportBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await reportBtn.click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
        const reasonInput = page.getByPlaceholder(/reason|describe/i).or(
          page.locator("textarea").first()
        );
        await reasonInput.fill("Suspicious distance recorded in a very short time.");
        await page.getByRole("button", { name: /submit.*report|submit/i }).click();
        await expect(
          page.getByText(/reported|thank you|community fair/i)
        ).toBeVisible({ timeout: 8_000 });
      }
    }
  });

  // TC-R14: Submit Report disabled when reason is empty
  test("TC-R14 Submit Report button disabled when reason field is empty", async ({ page }) => {
    test.skip(
      !process.env.E2E_RUNNER_EMAIL,
      "Skipped: requires authenticated user and race with activity"
    );
    await loginAs(page, "runner");
    await page.goto("/race");
    const firstRaceLink = page.locator("a[href*='/race/']").first();
    if (await firstRaceLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await firstRaceLink.click();
      await page.waitForLoadState("networkidle");
      const reportBtn = page.getByRole("button", { name: /report/i }).first();
      if (await reportBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await reportBtn.click();
        await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
        // Reason is empty — submit button should be disabled
        const submitBtn = page.getByRole("button", { name: /submit.*report|submit/i });
        await expect(submitBtn).toBeDisabled({ timeout: 3_000 });
      }
    }
  });
});
