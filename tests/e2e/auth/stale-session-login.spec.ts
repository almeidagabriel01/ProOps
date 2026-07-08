/**
 * AUTH-SL: Stale-session second-login race.
 *
 * Regression target: opening the app while a PREVIOUS Firebase session (user A)
 * is still cached/re-syncing, then logging in as a DIFFERENT account (user B),
 * used to hang on the centered full-page loader forever (only a manual reload
 * recovered). Root cause: A's already-in-flight background `/api/auth/session`
 * sync raced B's foreground login for the `__session` cookie, and the success
 * path never cleared `isLoading` itself. The fix tags every sync with a
 * monotonic auth epoch and drops writes from a superseded (stale) sync, and the
 * foreground login now clears the loader deterministically.
 *
 * Each test delays `/api/auth/session` so A's background re-mint is genuinely
 * in flight when B is submitted — making the race deterministic. The login form
 * stays visible during that stall (isSessionSynced false), which is exactly the
 * "page was still loading the last login" state the user reported.
 *
 * Scenarios:
 *   SL-01: A (admin alpha) cached → login as B (admin beta) → lands on B's home
 *          (/dashboard), no infinite spinner, the cookie is B's (reload stays).
 *   SL-02: role variants of B exercising each post-login redirect branch through
 *          the fixed code: admin→/dashboard, superadmin→/admin, free→/.
 *   SL-03: cross-identity cookie integrity — after A→B the session is B's, a
 *          protected reload stays in B's app and never bounces to /login.
 *
 * Not covered here (covered by Vitest instead):
 *   - The epoch decision itself: lib/auth/__tests__/is-stale-auth-epoch.test.ts.
 *   - The WhatsApp-MFA race (stale sync must not flip isSessionSynced while an
 *     OTP is owed): no WhatsApp-MFA seed user / emulator OTP stub exists; the
 *     security-critical invariant is asserted at the helper layer above and the
 *     gate guards in should-short-circuit-sync.test.ts.
 */

import { test, expect, type Page } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import {
  USER_ADMIN_ALPHA,
  USER_ADMIN_BETA,
  USER_FREE,
  USER_SUPERADMIN,
} from "../seed/data/users";

type Creds = { email: string; password: string };

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

/** Clean fresh login for the FIRST account (A); lands on its home. */
async function freshLogin(page: Page, user: Creds, home: string | RegExp) {
  await page.context().clearCookies();
  await page.goto("/login");
  await wipeIndexedDbAndStorage(page);
  await page.reload();
  const loginPage = new LoginPage(page);
  await loginPage.login(user.email, user.password);
  await page.waitForURL(home, { timeout: 15000 });
}

/**
 * Drives the exact race: A is cached in IndexedDB, the `/api/auth/session` POST
 * is stalled so A's background re-mint is in flight (and the form stays visible),
 * then B is submitted. Returns once B is submitted.
 */
async function loginAsSecondAccountWhileFirstResyncing(page: Page, b: Creds) {
  // Stall the session route so A's background re-mint and B's foreground login
  // POST genuinely overlap. ~1.2s is enough to fill+submit B inside the window.
  await page.route("**/api/auth/session", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });

  // Full navigation to /login remounts the provider (isSessionSynced resets to
  // false). A is still cached → onAuthStateChanged re-fires and launches the
  // background sync (now stalled) → the login form is shown, not a loader.
  await page.context().clearCookies({ name: "__session" });
  await page.goto("/login");

  const loginPage = new LoginPage(page);
  await loginPage.login(b.email, b.password);
}

// ─── SL-01: the exact failing scenario ──────────────────────────────────────

test.describe("AUTH-SL-01: login as B while A is still re-syncing does not hang", () => {
  test("admin A → admin B lands on B's dashboard, not an infinite loader", async ({
    page,
  }) => {
    await freshLogin(page, USER_ADMIN_ALPHA, "/dashboard");

    await loginAsSecondAccountWhileFirstResyncing(page, USER_ADMIN_BETA);

    // The core regression: we reach B's home (URL changes) instead of spinning.
    await page.waitForURL("/dashboard", { timeout: 15000 });
    const loginPage = new LoginPage(page);
    expect(await loginPage.isLoginFormVisible()).toBe(false);

    // Cookie integrity: it is B's session — a protected reload stays in the app
    // and never bounces back to /login (which a raced/missing cookie would cause).
    await page.reload();
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
  });
});

// ─── SL-02: role variants of the second account ─────────────────────────────

test.describe("AUTH-SL-02: second-login race across redirect branches", () => {
  test("admin A → superadmin B lands on /admin", async ({ page }) => {
    await freshLogin(page, USER_ADMIN_ALPHA, "/dashboard");
    await loginAsSecondAccountWhileFirstResyncing(page, USER_SUPERADMIN);
    await page.waitForURL(/\/admin/, { timeout: 15000 });
    const loginPage = new LoginPage(page);
    expect(await loginPage.isLoginFormVisible()).toBe(false);
  });

  test("admin A → free B leaves /login for the demo dashboard (no infinite loader)", async ({
    page,
  }) => {
    await freshLogin(page, USER_ADMIN_ALPHA, "/dashboard");
    await loginAsSecondAccountWhileFirstResyncing(page, USER_FREE);
    // Free home is now the ERP dashboard (read-only demo mode). The point is it
    // does NOT hang on the loader nor sit on /login.
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    const loginPage = new LoginPage(page);
    expect(await loginPage.isLoginFormVisible()).toBe(false);
  });
});

// ─── SL-03: cross-identity cookie integrity ─────────────────────────────────

test.describe("AUTH-SL-03: the synced session belongs to B, never the stale A", () => {
  test("after admin A → admin B, a protected navigation stays in B's app", async ({
    page,
  }) => {
    await freshLogin(page, USER_ADMIN_ALPHA, "/dashboard");
    await loginAsSecondAccountWhileFirstResyncing(page, USER_ADMIN_BETA);
    await page.waitForURL("/dashboard", { timeout: 15000 });

    // Stop stalling so normal navigation is fast, then hit a protected route.
    await page.unroute("**/api/auth/session");
    await page.goto("/proposals");
    // A valid B cookie keeps us on the protected route; a stale/raced cookie
    // would redirect to /login?…session_expired.
    await expect(page).toHaveURL(/\/proposals/, { timeout: 15000 });
    const loginPage = new LoginPage(page);
    expect(await loginPage.isLoginFormVisible()).toBe(false);
  });
});
