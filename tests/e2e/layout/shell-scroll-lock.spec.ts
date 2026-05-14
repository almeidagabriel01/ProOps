/**
 * LAYOUT-SCROLL-01: Authenticated shell scroll lock.
 *
 * Verifies that ProtectedAppShell sets data-shell="locked" on <html> and
 * that the CSS rule prevents document-level (html/window) scroll while inside
 * the authenticated shell.
 *
 * Bug: Before the fix, html[scroll] and main[scroll] both appeared in DevTools
 * because <html> had no overflow:hidden anchor — siblings of the shell
 * (ToastProvider, Analytics nodes, DPR rounding on Windows) leaked past the
 * flex h-screen overflow-hidden container.
 *
 * After the fix: only <main id="main-content"> should scroll; <html> should
 * have overflow:hidden and data-shell="locked".
 *
 * Public routes (no ProtectedAppShell) must NOT have data-shell="locked".
 */

import { test, expect } from "../fixtures/base.fixture";
import { LoginPage } from "../pages/login.page";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

test.describe("LAYOUT-SCROLL-01: shell data-shell lock attribute", () => {
  test("authenticated route has data-shell=locked on <html>", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

    // Navigate to a stable authenticated route
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const dataShell = await page.evaluate(() =>
      document.documentElement.dataset.shell,
    );
    expect(dataShell).toBe("locked");
  });

  test("authenticated route has overflow:hidden on <html>", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).overflow,
    );
    expect(overflow).toBe("hidden");
  });

  test("public route does NOT have data-shell on <html>", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const dataShell = await page.evaluate(() =>
      document.documentElement.dataset.shell,
    );
    expect(dataShell).toBeUndefined();
  });

  test("<html> overflow is not hidden on public route", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).overflow,
    );
    expect(overflow).not.toBe("hidden");
  });
});
