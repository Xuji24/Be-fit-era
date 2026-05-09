import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Community feed E2E tests.
 * Requires a valid runner test user in env vars (E2E_RUNNER_EMAIL / E2E_RUNNER_PASSWORD).
 */
test.describe("Community feed (authenticated)", () => {
  test.skip(
    !process.env.E2E_RUNNER_EMAIL,
    "Skipped: set E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD to run authenticated tests"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "runner");
  });

  test("community feed shows posts or empty state", async ({ page }) => {
    await page.goto("/community");
    const post = page.locator("article, [data-testid='post-card']").first();
    const empty = page.getByText(/no posts yet|be the first/i);
    const hasContent = (await post.isVisible({ timeout: 8_000 })) || (await empty.isVisible());
    expect(hasContent).toBeTruthy();
  });

  test("can open create post modal", async ({ page }) => {
    await page.goto("/community");
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder(/what's on your mind/i)).toBeVisible();
  });

  test("post modal closes on cancel", async ({ page }) => {
    await page.goto("/community");
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 });
  });

  test("post modal enforces 1000 character limit", async ({ page }) => {
    await page.goto("/community");
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    const textarea = page.getByPlaceholder(/what's on your mind/i);
    const longText = "A".repeat(1001);
    await textarea.fill(longText);
    // Post button should be disabled (over limit)
    const postBtn = page.getByRole("button", { name: /^post$/i });
    await expect(postBtn).toBeDisabled();
  });
});
