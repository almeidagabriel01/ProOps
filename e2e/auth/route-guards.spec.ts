import { test, expect } from "../fixtures/base.fixture";

/**
 * AUTH-05: Route guard tests — unauthenticated redirect.
 *
 * These tests verify that the Next.js middleware redirects unauthenticated
 * users to /login, preserving the intended destination and reason in query params.
 *
 * All tests deliberately run WITHOUT any auth cookies. The middleware checks for
 * both '__session' and the legacy 'firebase-auth-token' hint cookie, so both
 * must be cleared before each test.
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

    const redirectParam = new URL(page.url()).searchParams.get("redirect");
    expect(redirectParam).toBe("/dashboard");
  });

  test("redirect URL includes 'redirect_reason=session_expired' query param", async ({ page }) => {
    await page.goto("/proposals");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    const redirectReason = new URL(page.url()).searchParams.get("redirect_reason");
    expect(redirectReason).toBe("session_expired");
  });
});
