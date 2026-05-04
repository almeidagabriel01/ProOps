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
  test.beforeEach(async ({ context, page }) => {
    // Clear cookies (server session) AND IndexedDB (Firebase Auth persisted user).
    // Firebase Auth stores the persisted user in firebaseLocalStorageDb IndexedDB;
    // without clearing it, the login page sees auth.currentUser != null on mount,
    // calls handleRedirectAfterAuth, and bounces via window.location.replace —
    // stripping the redirect / redirect_reason query params before our assertions.
    await context.clearCookies();

    // IndexedDB cleanup must run in a page context. Navigate to a same-origin
    // page first so localStorage/indexedDB APIs are available, then clear.
    await page.goto("/login");
    await page.evaluate(async () => {
      const dbs = (await indexedDB.databases?.()) ?? [];
      await Promise.all(
        dbs.map(
          (db) =>
            new Promise<void>((resolve) => {
              if (!db.name) return resolve();
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = req.onerror = req.onblocked = () => resolve();
            }),
        ),
      );
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore — some origins block storage access
      }
    });
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
