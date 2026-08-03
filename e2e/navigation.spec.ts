import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

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

test.describe("Navbar role-based links", () => {
  test.skip(
    !process.env.E2E_ORGANIZER_EMAIL || !process.env.E2E_ORGANIZER_PASSWORD,
    "Skipped: set E2E_ORGANIZER_EMAIL and E2E_ORGANIZER_PASSWORD",
  );

  test("organizer link visible after login without page reload", async ({
    page,
  }) => {
    await loginAs(page, "organizer");
    await page.goto("/");

    const organizerLink = page.getByRole("link", { name: /^Organizer$/i });
    await expect(organizerLink).toBeVisible({ timeout: 8_000 });
  });
});
