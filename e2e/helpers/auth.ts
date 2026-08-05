/**
 * Shared test helpers for Be Fit Era E2E tests.
 * Usage: import { loginAs, TEST_USERS } from "./helpers/auth";
 */

import type { Page } from "@playwright/test";

export const TEST_USERS = {
  runner: {
    email: process.env.E2E_RUNNER_EMAIL ?? "runner@test.com",
    password: process.env.E2E_RUNNER_PASSWORD ?? "Test@1234",
  },
  organizer: {
    email: process.env.E2E_ORGANIZER_EMAIL ?? "organizer@test.com",
    password: process.env.E2E_ORGANIZER_PASSWORD ?? "Test@1234",
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@test.com",
    password: process.env.E2E_ADMIN_PASSWORD ?? "Test@1234",
  },
};

export async function loginAs(page: Page, role: keyof typeof TEST_USERS) {
  const user = TEST_USERS[role];

  // Use the test-only API route to bypass hCaptcha.
  // The route calls signInWithPassword via @supabase/ssr and sets session cookies
  // in the response — Playwright's context picks them up automatically.
  const res = await page.request.post("/api/e2e/login", {
    data: { email: user.email, password: user.password },
  });

  if (!res.ok()) {
    throw new Error(`E2E login failed for ${role} (${user.email}): ${await res.text()}`);
  }

  // Navigate to home so middleware refreshes and the session is live
  await page.goto("/");
  await page.waitForLoadState("networkidle");
}

export async function logout(page: Page) {
  await page.goto("/");
  // Try profile dropdown logout
  const profileBtn = page.getByRole("button", { name: /profile|account/i }).first();
  if (await profileBtn.isVisible()) {
    await profileBtn.click();
    await page.getByRole("menuitem", { name: /log out|sign out/i }).click();
    await page.waitForURL("**/login", { timeout: 8_000 });
  }
}
