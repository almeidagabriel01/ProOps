/**
 * AUTH-SR: Session-recovery hardening tests.
 *
 * Regression target: a user returning after the __session cookie expired used to
 * hit an infinite loading spinner. Recovery is now deterministic — the proxy
 * routes a missing/expired cookie through the /auth/refresh interstitial, which
 * silently re-mints the cookie from the still-valid Firebase refresh token (no
 * login form), or bounces to /login when the refresh token is also gone.
 *
 * Scenarios:
 *   SR-01: cookie gone but Firebase session alive → silent re-mint, lands on the
 *          intended page, the login form NEVER appears. (Fails without the fix.)
 *   SR-02: cookie AND Firebase session gone → terminal /login with the form, a
 *          session-expired toast, and never an infinite spinner.
 *   SR-05: cookie dropped mid-session + CLIENT-SIDE navigation (warm provider,
 *          30s sync cooldown active) → re-mints and lands on the target page.
 *          This is the staging freeze repro: SR-01's page.goto() is a hard
 *          navigation that remounts the provider and resets its state, so it
 *          never caught the stale-isSessionSynced short-cut that froze
 *          /auth/refresh forever. (Fails without the fix.)
 *
 * Not covered here (covered by Vitest unit tests instead):
 *   - SR-03 billing-gate `session_expired` param unification: the proxy's billing
 *     check is a server-to-server fetch the browser can't intercept. Logic is
 *     verified by lib/auth/__tests__/decide-expired-redirect.test.ts.
 *   - SR-04 auth-init watchdog ceiling: the stall it guards (a hung Firestore
 *     read) isn't a browser-interceptable HTTP call. Logic is verified by
 *     lib/auth/__tests__/should-force-terminal-auth-state.test.ts and
 *     lib/async/__tests__/with-timeout.test.ts.
 */

import { test, expect, type Page } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { USER_ADMIN_ALPHA } from "../seed/data/users";

async function wipeIndexedDbAndStorage(page: Page) {
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
      // noop
    }
  });
}

async function freshLogin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await wipeIndexedDbAndStorage(page);
  await page.reload();
  const loginPage = new LoginPage(page);
  await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
  await page.waitForURL("/dashboard", { timeout: 15000 });
}

// ─── SR-01: silent re-mint when only the cookie expired ────────────────────

test.describe("AUTH-SR-01: expired __session is silently re-minted", () => {
  test("deleting only the cookie recovers to the intended page without showing the login form", async ({
    page,
  }) => {
    await freshLogin(page);

    // Simulate the cookie expiring/being dropped while the Firebase session
    // (IndexedDB refresh token) stays alive — exactly the returning-after-days
    // state. Keep IndexedDB intact.
    await page.context().clearCookies({ name: "__session" });

    const loginPage = new LoginPage(page);

    // Navigate to a protected page: proxy → /auth/refresh → silent re-mint → back.
    await page.goto("/dashboard");

    // Recovered onto the dashboard...
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
    // ...and the login form never surfaced during recovery.
    expect(await loginPage.isLoginFormVisible()).toBe(false);
  });
});

// ─── SR-02: terminal fallback when the refresh token is also gone ───────────

test.describe("AUTH-SR-02: fully-expired session falls back to /login (no infinite spinner)", () => {
  test("clearing the cookie AND the Firebase session lands on the login form", async ({
    page,
  }) => {
    await freshLogin(page);

    // Both the cookie and the Firebase refresh token are gone — nothing to
    // re-mint from.
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await wipeIndexedDbAndStorage(page);
    await page.goto("/dashboard");

    // Terminal: the interstitial cannot recover → /login with the form visible.
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    const loginPage = new LoginPage(page);
    await expect(loginPage.emailInput).toBeVisible({ timeout: 15000 });
  });
});

// ─── SR-05: cookie dropped mid-session, soft navigation (the staging freeze) ─

test.describe("AUTH-SR-05: soft navigation recovers after the cookie is dropped mid-session", () => {
  test("clicking a nav link right after the cookie vanishes re-mints and reaches the page (no frozen interstitial)", async ({
    page,
  }) => {
    // Pre-dismiss the cookie-consent banner on every document load — it is a
    // fixed bottom z-[100] overlay that intercepts clicks on the bottom dock.
    // (freshLogin wipes localStorage, so this must be an init script, not a
    // one-off set.) Key/value mirror apps/web/src/lib/cookie-consent-storage.ts.
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("proops_cookie_consent", "dismissed");
      } catch {
        // noop
      }
    });

    await freshLogin(page);

    // Drop ONLY the cookie seconds after login: provider state is warm
    // (isSessionSynced=true, 30s sync cooldown active) — the exact staging
    // state that used to freeze /auth/refresh forever.
    await page.context().clearCookies({ name: "__session" });

    // The bottom dock auto-hides via CSS transform after idle time. Reveal it
    // by moving the mouse into the bottom hotzone and wait for the link to be
    // actually inside the viewport (same pattern as DashboardPage.logout()).
    const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
    await page.mouse.move(viewport.width / 2, viewport.height - 2);
    await page.waitForFunction(
      () => {
        const link = document.querySelector('a[aria-label="Propostas"]');
        if (!link) return false;
        const rect = link.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.height > 0;
      },
      undefined,
      { timeout: 5000 },
    );

    // CLIENT-SIDE navigation (must NOT be page.goto — that hard-nav remounts
    // the provider and hides the bug). /proposals is dynamic, so the click
    // issues an RSC request that goes through the proxy.
    await page.locator('a[aria-label="Propostas"]').click();

    // Recovered onto the target page, not frozen at /auth/refresh...
    await expect(page).toHaveURL(/\/proposals/, { timeout: 15000 });
    // ...and the login form never surfaced during recovery.
    const loginPage = new LoginPage(page);
    expect(await loginPage.isLoginFormVisible()).toBe(false);
  });
});
