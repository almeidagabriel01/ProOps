import { test, expect } from "../fixtures/base.fixture";

/**
 * AUTH-05: Route guard tests — unauthenticated redirect.
 *
 * These tests verify that the Next.js middleware redirects unauthenticated
 * users to /login with redirect and redirect_reason query params
 * (middleware.ts lines 117-120: loginUrl.searchParams.set).
 *
 * All tests deliberately run WITHOUT any auth cookies.
 */

test.describe("AUTH-05: Route guards — unauthenticated redirect", () => {
  test.beforeEach(async ({ context }) => {
    // Clear both the primary session cookie and the legacy auth hint cookie
    // so the middleware sees a fully unauthenticated request.
    await context.clearCookies();
  });

  test("navigating to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("navigating to /proposals redirects to /login", async ({ page }) => {
    await page.goto("/proposals");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("navigating to /transactions redirects to /login", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test("redirect URL includes the original path as 'redirect' query param", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    // The Next.js middleware sets redirect=<path> in the 307 Location header.
    // Playwright follows the redirect and the final URL should include the param.
    expect(new URL(page.url()).searchParams.get("redirect")).toBe("/dashboard");
  });

  test("redirect URL includes 'redirect_reason=session_expired' query param", async ({ page }) => {
    await page.goto("/proposals");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    // The Next.js middleware sets redirect_reason=session_expired (middleware.ts line 119).
    expect(new URL(page.url()).searchParams.get("redirect_reason")).toBe(
      "session_expired",
    );
  });
});
