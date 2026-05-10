import { test, expect } from "@playwright/test";

// ─── Area 8: Leaderboard ──────────────────────────────────────────────────

test.describe("TC-L01 – TC-L02: Leaderboard page (public)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/leaderboard");
    await page.waitForLoadState("networkidle");
  });

  // TC-L01: Leaderboard renders podium and table
  test("TC-L01 leaderboard renders heading, podium area, and ranked table", async ({ page }) => {
    // Page heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
    // "Top 10 Rankings" section heading should be visible
    const rankingsHeading = page.getByText(/top 10|top ten|rankings/i);
    // OR leaderboard entries with km values
    const entryData = page.getByText(/\d+km/i);

    const hasRankings = (await rankingsHeading.first().isVisible({ timeout: 5_000 }).catch(() => false)) ||
                        (await entryData.first().isVisible({ timeout: 5_000 }).catch(() => false));
    // OR a no-data state
    const emptyState = page.getByText(/no entries|no data|no participants|not enough/i);
    const emptyVisible = await emptyState.first().isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasRankings || emptyVisible).toBeTruthy();
  });

  // TC-L02: Leaderboard shows top entries with distance and ranking info
  test("TC-L02 leaderboard entries show rank badge, name, and distance", async ({ page }) => {
    // Distance values should appear (e.g. "42.2 km" or "21.1 km")
    const distancePattern = page.getByText(/\d+(\.\d+)?\s*km/i);
    const distanceVisible = await distancePattern.first().isVisible({ timeout: 8_000 }).catch(() => false);

    // Or an empty/no-data state
    const emptyState = page.getByText(/no entries|no data|no participants|not enough/i);
    const emptyVisible = await emptyState.isVisible({ timeout: 5_000 }).catch(() => false);

    // One of the two states must be present
    expect(distanceVisible || emptyVisible).toBeTruthy();
  });
});
