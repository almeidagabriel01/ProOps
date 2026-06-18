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

  // The proxy routes an unauthenticated protected request through the silent
  // re-mint interstitial (/auth/refresh), preserving the intended path in
  // `next`. /auth/refresh then recovers the session or bounces to /login
  // CLIENT-SIDE — so a raw APIRequestContext (no JS) observes the proxy's
  // immediate redirect to /auth/refresh, not the eventual /login. The
  // browser-based tests above assert the eventual /login.
  test("proxy routes /dashboard through /auth/refresh, preserving the path in 'next'", async ({ playwright }) => {
    // playwright.request.newContext() creates a fully isolated APIRequestContext
    // with an empty cookie jar — no __session cookie, no browser state.
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3001" });
    try {
      const resp = await ctx.fetch("/dashboard");
      const url = new URL(resp.url());
      expect(url.pathname).toBe("/auth/refresh");
      expect(url.searchParams.get("next")).toBe("/dashboard");
    } finally {
      await ctx.dispose();
    }
  });

  test("proxy preserves a different protected path (/proposals) in 'next'", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3001" });
    try {
      const resp = await ctx.fetch("/proposals");
      const url = new URL(resp.url());
      expect(url.pathname).toBe("/auth/refresh");
      expect(url.searchParams.get("next")).toBe("/proposals");
    } finally {
      await ctx.dispose();
    }
  });

  // Legal/bureaucratic pages must be reachable while logged out — the cookie
  // banner links to /cookies, and a logged-out visitor must read the policy
  // without being bounced to /login. Regression: /cookies was missing from the
  // middleware PUBLIC_ROUTES, so it redirected to /login with session_expired.
  for (const path of ["/cookies", "/privacy", "/terms", "/data-deletion"]) {
    test(`public legal route ${path} is reachable without auth (no redirect to /login)`, async ({ playwright }) => {
      const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3001" });
      try {
        const resp = await ctx.fetch(path);
        const url = new URL(resp.url());
        expect(url.pathname).toBe(path);
        expect(url.pathname).not.toBe("/login");
      } finally {
        await ctx.dispose();
      }
    });
  }

  // Public booking page (hero CTA "marcar reunião" links here). It's classified
  // public in providers.tsx (no ERP shell / ProtectedRoute), so the proxy must
  // also treat it as public. Regression: /agendar was missing from PUBLIC_ROUTES,
  // so a visitor (or a logged-in user whose __session cookie expired) was bounced
  // to /auth/refresh?next=/agendar and the recovery interstitial spun there.
  test("public booking route /agendar is reachable without auth (no redirect to /auth/refresh or /login)", async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3001" });
    try {
      const resp = await ctx.fetch("/agendar");
      const url = new URL(resp.url());
      expect(url.pathname).toBe("/agendar");
      expect(url.pathname).not.toBe("/auth/refresh");
      expect(url.pathname).not.toBe("/login");
    } finally {
      await ctx.dispose();
    }
  });
});
