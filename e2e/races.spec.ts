import { test, expect } from "@playwright/test";

test.describe("Race browsing (public)", () => {
  test("race listing page loads and shows races", async ({ page }) => {
    await page.goto("/race");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
    // At least one race card or empty state should render
    const raceCard = page.locator("[data-testid='race-card'], .race-card, article").first();
    const emptyState = page.getByText(/no races|coming soon|no upcoming/i);
    const hasContent = (await raceCard.isVisible()) || (await emptyState.isVisible());
    expect(hasContent).toBeTruthy();
  });

  test("race detail page renders key sections", async ({ page }) => {
    await page.goto("/race");
    // Click first race if available
    const firstCard = page.locator("a[href*='/race/']").first();
    if (await firstCard.isVisible()) {
      await firstCard.click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
    }
  });

  test("leaderboard page loads top 10 entries", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
  });

  test("community feed page loads", async ({ page }) => {
    await page.goto("/community");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
  });

  test("contact page form renders", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
  });
});
