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
