import { test, expect } from "@playwright/test";

/**
 * Navigation & layout smoke tests — no auth required.
 */
test.describe("Navigation & layout", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("navbar is visible on home page", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav, header").first();
    await expect(nav).toBeVisible({ timeout: 8_000 });
  });

  test("footer is rendered", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible({ timeout: 8_000 });
  });

  test("404 page shows for unknown route", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz");
    await expect(
      page.getByText(/not found|404|page does not exist/i)
    ).toBeVisible({ timeout: 8_000 });
  });

  test("dark mode toggle exists", async ({ page }) => {
    await page.goto("/");
    // Theme toggle button should exist (may be in navbar or floating)
    const themeToggle = page
      .getByRole("button", { name: /theme|dark|light|toggle/i })
      .first();
    await expect(themeToggle).toBeVisible({ timeout: 8_000 });
  });
});
