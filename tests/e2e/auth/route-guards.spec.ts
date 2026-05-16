import { test, expect } from "../fixtures/base.fixture";

/**
 * AUTH-05: Route guard tests — unauthenticated redirect.
 *
 * These tests verify that the Next.js middleware redirects unauthenticated
 * users to /login with redirect and redirect_reason query params
 * (middleware.ts: loginUrl.searchParams.set).
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
    // Re-clear cookies: page.goto("/login") above may trigger Firebase SDK to
    // re-issue firebase-auth-token from IndexedDB before the evaluate() wipe.
    // A second clear ensures no legacy cookie survives into the test body.
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

  test("redirect URL includes the original path as 'redirect' query param", async ({ playwright }) => {
    // playwright.request.newContext() creates a fully isolated APIRequestContext
    // with an empty cookie jar — no __session cookie, no browser state.
    // Following the redirect lets us inspect the final URL the middleware sends
    // the user to, without depending on maxRedirects:0 edge-case behavior.
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3001" });
    try {
      const resp = await ctx.fetch("/dashboard");
      const url = new URL(resp.url());
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("redirect")).toBe("/dashboard");
    } finally {
      await ctx.dispose();
    }
  });

  test("redirect URL includes 'redirect_reason=session_expired' query param", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3001" });
    try {
      const resp = await ctx.fetch("/proposals");
      const url = new URL(resp.url());
      expect(url.pathname).toBe("/login");
      expect(url.searchParams.get("redirect_reason")).toBe("session_expired");
    } finally {
      await ctx.dispose();
    }
  });
});
