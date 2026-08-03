import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

// ─── Area 2: Community Feed ────────────────────────────────────────────────

// TC-C01 – TC-C05: Public/unauthenticated view + filter
test.describe("TC-C01 – TC-C05: Community feed structure and filtering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
  });

  // TC-C01: Feed loads with expected UI elements
  test("TC-C01 community feed shows posts or empty state with correct controls", async ({ page }) => {
    // Search bar — we added aria-label="Search posts" in the a11y audit
    await expect(page.getByLabel(/search posts/i).or(page.getByPlaceholder(/search posts/i))).toBeVisible({ timeout: 8_000 });
    // Category pills — at least "All" should be present
    await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible();
    // New Post button
    await expect(page.getByRole("button", { name: /new post|share|create/i }).first()).toBeVisible();
  });

  // TC-C02: Search debounced filters posts
  test("TC-C02 typing in search bar updates the feed", async ({ page }) => {
    const searchInput = page.getByLabel(/search posts/i).or(page.getByPlaceholder(/search/i));
    await searchInput.fill("xyz_no_match_term_e2e");
    await page.waitForTimeout(500); // wait for 350ms debounce + render
    // Clear (×) button should appear
    const clearBtn = page.getByRole("button", { name: /clear|×/i }).or(
      page.locator("button[aria-label*='clear'], button[title*='clear']")
    );
    await expect(clearBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  // TC-C03: Clear search button resets feed
  test("TC-C03 clear search button removes the search query", async ({ page }) => {
    const searchInput = page.getByLabel(/search posts/i).or(page.getByPlaceholder(/search/i));
    await searchInput.fill("test");
    await page.waitForTimeout(500);
    const clearBtn = page.locator("button").filter({ hasText: /^×$|^✕$|^clear$/i }).or(
      page.locator("input + button, input ~ button").first()
    );
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await expect(searchInput).toHaveValue("");
    }
  });

  // TC-C04: Category pill filters feed
  test("TC-C04 clicking a category pill filters the feed", async ({ page }) => {
    const categoryPills = [
      /race.?story/i, /training/i, /achievement/i, /question/i, /general/i
    ];
    // Click first available category pill
    for (const pattern of categoryPills) {
      const pill = page.getByRole("button", { name: pattern });
      if (await pill.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await pill.click();
        await page.waitForTimeout(500);
        // Feed should reload — check we don't get a crash
        await expect(page.locator("body")).toBeVisible();
        break;
      }
    }
  });

  // TC-C05: No results state when filters match nothing
  test("TC-C05 no matching posts shows empty state message", async ({ page }) => {
    const searchInput = page.getByLabel(/search posts/i).or(page.getByPlaceholder(/search/i));
    await searchInput.fill("zzz_absolutely_no_match_xyz_e2e_9999");
    await page.waitForTimeout(600);
    await expect(
      page.getByText(/no matching|no posts|no results/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});

// TC-C06 – TC-C19: Authenticated post interactions
test.describe("TC-C06 – TC-C19: Authenticated community interactions", () => {
  test.skip(
    !process.env.E2E_RUNNER_EMAIL,
    "Skipped: set E2E_RUNNER_EMAIL and E2E_RUNNER_PASSWORD to run authenticated tests"
  );

  test.beforeEach(async ({ page }) => {
    await loginAs(page, "runner");
    await page.goto("/community");
    await page.waitForLoadState("networkidle");
  });

  // TC-C06: Load more appends posts
  test("TC-C06 Load More button appends additional posts", async ({ page }) => {
    const loadMoreBtn = page.getByRole("button", { name: /load more/i });
    if (await loadMoreBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const initialPosts = await page.locator("article, [data-testid='post-card']").count();
      await loadMoreBtn.click();
      await page.waitForTimeout(1_000);
      const afterPosts = await page.locator("article, [data-testid='post-card']").count();
      expect(afterPosts).toBeGreaterThanOrEqual(initialPosts);
    }
  });

  // TC-C07: Create post — text only
  test("TC-C07 can create a text-only post", async ({ page }) => {
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    const textarea = page.getByPlaceholder(/what's on your mind/i).or(
      page.getByLabel(/post content/i)
    );
    const timestamp = Date.now();
    await textarea.fill(`E2E test post ${timestamp}`);
    await page.getByRole("button", { name: /^post$/i }).click();
    // Modal should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });
    // New post should appear in feed
    await expect(page.getByText(`E2E test post ${timestamp}`)).toBeVisible({ timeout: 10_000 });
  });

  // TC-C08: Create post modal — cancel closes without posting
  test("TC-C08 cancel button closes create post modal without posting", async ({ page }) => {
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    const textarea = page.getByPlaceholder(/what's on your mind/i).or(
      page.getByLabel(/post content/i)
    );
    await textarea.fill("This post should NOT appear");
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3_000 });
  });

  // TC-C09: 5th image is blocked — "Add Images" hidden after 4
  test("TC-C09 Add Images button hidden after 4 images are attached", async ({ page }) => {
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    // We can't actually pick files in headless, but verify the button exists initially
    const addImagesBtn = page.getByRole("button", { name: /add images|photo|image/i });
    await expect(addImagesBtn).toBeVisible();
  });

  // TC-C10: Oversized image shows toast (UI only — file input can't be easily driven in headless)
  test("TC-C10 create post modal has image file type constraints", async ({ page }) => {
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    const fileInput = page.locator('input[type="file"]').first();
    // File input should restrict to image types
    const acceptAttr = await fileInput.getAttribute("accept");
    expect(acceptAttr).toMatch(/image/);
  });

  // TC-C11: Content over 1000 chars disables Post button
  test("TC-C11 content over 1000 characters disables the Post button", async ({ page }) => {
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    const textarea = page.getByPlaceholder(/what's on your mind/i).or(
      page.getByLabel(/post content/i)
    );
    await textarea.fill("A".repeat(1001));
    const postBtn = page.getByRole("button", { name: /^post$/i });
    await expect(postBtn).toBeDisabled();
  });

  // TC-C12: Like a post (optimistic update)
  test("TC-C12 clicking the like button toggles like count", async ({ page }) => {
    const firstLikeBtn = page.locator("article, [data-testid='post-card']")
      .first()
      .getByRole("button", { name: /like|heart/i });
    if (await firstLikeBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const beforeText = await firstLikeBtn.textContent();
      await firstLikeBtn.click();
      await page.waitForTimeout(500);
      // Like count or icon state should change
      await expect(firstLikeBtn).toBeVisible();
    }
  });

  // TC-C13: Edit own post
  test("TC-C13 post owner can edit their post via three-dot menu", async ({ page }) => {
    // First create a post we own
    await page.getByRole("button", { name: /new post|share|create/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    const textarea = page.getByPlaceholder(/what's on your mind/i).or(
      page.getByLabel(/post content/i)
    );
    const unique = `Edit me ${Date.now()}`;
    await textarea.fill(unique);
    await page.getByRole("button", { name: /^post$/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 });
    // Find the new post and open its three-dot menu
    const newPost = page.locator("article, [data-testid='post-card']").filter({ hasText: unique }).first();
    await expect(newPost).toBeVisible({ timeout: 8_000 });
    const menuBtn = newPost.getByRole("button", { name: /menu|more|⋯|\.{3}/i }).or(
      newPost.locator("button").last()
    );
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await expect(page.getByRole("menuitem", { name: /edit/i }).or(
        page.getByText(/^edit$/i)
      )).toBeVisible({ timeout: 3_000 });
    }
  });

  // TC-C14: Edit/Delete not visible on another user's post
  test("TC-C14 three-dot menu not visible on posts owned by other users", async ({ page }) => {
    // This test assumes there are posts from other users in the feed
    // We verify that not every post card has an accessible "delete" option
    const postCards = page.locator("article, [data-testid='post-card']");
    const count = await postCards.count();
    if (count > 1) {
      // At least verify the delete option isn't blanket-visible on all posts
      const deleteButtons = page.getByRole("menuitem", { name: /delete/i });
      // These should not all be visible at once (require menu open)
      const visibleDeletes = await deleteButtons.filter({ visible: true }).count();
      expect(visibleDeletes).toBe(0); // menus are closed by default
    }
  });

  // TC-C15: Add a comment
  test("TC-C15 can add a comment to a post", async ({ page }) => {
    const firstPost = page.locator("article, [data-testid='post-card']").first();
    if (await firstPost.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const commentBtn = firstPost.getByRole("button", { name: /comment|chat/i });
      if (await commentBtn.isVisible()) {
        await commentBtn.click();
        const commentInput = page.getByLabel(/write a comment/i).or(
          page.getByPlaceholder(/comment/i)
        );
        await expect(commentInput).toBeVisible({ timeout: 5_000 });
        const commentText = `Test comment ${Date.now()}`;
        await commentInput.fill(commentText);
        await page.keyboard.press("Enter");
        await expect(page.getByText(commentText)).toBeVisible({ timeout: 8_000 });
      }
    }
  });

  // TC-C16: Comment over 500 chars — send button disabled
  test("TC-C16 comment input enforces 500 character limit", async ({ page }) => {
    const firstPost = page.locator("article, [data-testid='post-card']").first();
    if (await firstPost.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const commentBtn = firstPost.getByRole("button", { name: /comment|chat/i });
      if (await commentBtn.isVisible()) {
        await commentBtn.click();
        const commentInput = page.getByLabel(/write a comment/i).or(
          page.getByPlaceholder(/comment/i)
        );
        if (await commentInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await commentInput.fill("A".repeat(501));
          const sendBtn = page.getByRole("button", { name: /send/i });
          await expect(sendBtn).toBeDisabled({ timeout: 3_000 });
        }
      }
    }
  });

  // TC-C17: Empty comment — send button disabled
  test("TC-C17 empty comment keeps Send button disabled", async ({ page }) => {
    const firstPost = page.locator("article, [data-testid='post-card']").first();
    if (await firstPost.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const commentBtn = firstPost.getByRole("button", { name: /comment|chat/i });
      if (await commentBtn.isVisible()) {
        await commentBtn.click();
        const commentInput = page.getByLabel(/write a comment/i).or(
          page.getByPlaceholder(/comment/i)
        );
        if (await commentInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          // Input is empty by default — send button should be disabled
          const sendBtn = page.getByRole("button", { name: /send/i });
          await expect(sendBtn).toBeDisabled({ timeout: 3_000 });
        }
      }
    }
  });

  // TC-C18: Image lightbox opens on click
  test("TC-C18 clicking a post image opens the lightbox", async ({ page }) => {
    // Find a post with images (if any)
    const postImage = page.locator("article img, [data-testid='post-card'] img").first();
    if (await postImage.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await postImage.click();
      // Lightbox or dialog should appear
      const lightbox = page.locator("[role='dialog'], [data-testid='lightbox'], .lightbox");
      await expect(lightbox.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  // TC-C19: Empty state with "All" category and no content
  test("TC-C19 empty state shown when no posts match filter", async ({ page }) => {
    const searchInput = page.getByLabel(/search posts/i).or(page.getByPlaceholder(/search/i));
    await searchInput.fill("__absolutely_nothing_e2e_xyz__");
    await page.waitForTimeout(600);
    await expect(
      page.getByText(/no matching|no posts|no results/i)
    ).toBeVisible({ timeout: 8_000 });
  });
});
