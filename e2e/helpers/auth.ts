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
  await page.goto("/login");
  // Auth forms use visual labels only (no htmlFor/id), so use placeholder to locate inputs
  await page.getByPlaceholder(/email/i).fill(user.email);
  await page.locator('input[type="password"]').first().fill(user.password);
  await page.getByRole("button", { name: /log in|login|sign in/i }).click();
  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 });
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
