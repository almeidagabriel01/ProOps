/**
 * AUTH-SB: /subscription-blocked guard tests.
 *
 * Verifies that the layout.tsx guard correctly renders or redirects users
 * depending on their session and subscription status.
 *
 * Scenarios covered:
 *   SB-01: Anon user → page renders (generic blocked content)
 *   SB-02: Free role → redirect to /
 *   SB-03: Active subscription → redirect to /
 *   SB-04: Trialing subscription → redirect to /
 *   SB-05: Canceled (hard blocked) → page renders
 *   SB-06: Past_due within grace period → redirect to /
 *   SB-07: Past_due outside grace period → page renders
 *   SB-08: Past_due without pastDueSince → page renders (fail-closed)
 */

import { test, expect } from "../fixtures/base.fixture";
import { LoginPage } from "../pages/login.page";
import { getTestDb } from "../helpers/admin-firestore";
import { seedBillingStateExtended, restoreTenantState } from "../seed/data/billing";
import { USER_ADMIN_BETA, USER_FREE } from "../seed/data/users";

const PAYING_TENANT = "tenant-beta";
const PAST_DUE_GRACE_DAYS = 7;

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function clearSessionAndStorage(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
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
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  });
}

// ─── SB-01: Anon user ────────────────────────────────────────────────────────

test.describe("AUTH-SB-01: Anon user sees blocked page", () => {
  test.beforeEach(async ({ page }) => clearSessionAndStorage(page));

  test("anon navigates to /subscription-blocked → page renders", async ({ page }) => {
    await page.goto("/subscription-blocked");
    await expect(page).toHaveURL(/\/subscription-blocked/, { timeout: 10000 });
    // Should not be redirected to /login (anon is allowed to see this page)
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── SB-02: Free role ────────────────────────────────────────────────────────

test.describe("AUTH-SB-02: Free user redirected from /subscription-blocked", () => {
  test("free user navigates to /subscription-blocked → redirected to /", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_FREE.email, USER_FREE.password);
    await page.waitForURL(/dashboard/, { timeout: 15000 });

    await page.goto("/subscription-blocked");
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });
});

// ─── SB-03 / SB-04: Active / Trialing ───────────────────────────────────────

test.describe("AUTH-SB-03/04: Active/Trialing subscription redirected from /subscription-blocked", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, PAYING_TENANT);
  });

  test("active subscription → redirected to /", async ({ page }) => {
    await seedBillingStateExtended(db, {
      tenantId: PAYING_TENANT,
      subscriptionStatus: "active",
      userId: USER_ADMIN_BETA.uid,
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    await page.goto("/subscription-blocked");
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("trialing subscription → redirected to /", async ({ page }) => {
    await seedBillingStateExtended(db, {
      tenantId: PAYING_TENANT,
      subscriptionStatus: "trialing",
      userId: USER_ADMIN_BETA.uid,
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    await page.goto("/subscription-blocked");
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });
});

// ─── SB-05: Canceled (hard blocked) ─────────────────────────────────────────

test.describe("AUTH-SB-05: Canceled subscription stays on /subscription-blocked", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, PAYING_TENANT);
  });

  test("canceled subscription → /subscription-blocked renders", async ({ page }) => {
    await seedBillingStateExtended(db, {
      tenantId: PAYING_TENANT,
      subscriptionStatus: "canceled",
      userId: USER_ADMIN_BETA.uid,
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    // May land on /subscription-blocked right away, or be redirected there from home
    await page.waitForURL(/\/(subscription-blocked|login)/, { timeout: 15000 });

    await page.goto("/subscription-blocked");
    await expect(page).toHaveURL(/\/subscription-blocked/, { timeout: 10000 });
  });
});

// ─── SB-06: Past_due within grace ───────────────────────────────────────────

test.describe("AUTH-SB-06: Past_due within grace period redirected from /subscription-blocked", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, PAYING_TENANT);
  });

  test("past_due within grace → redirected to /", async ({ page }) => {
    await seedBillingStateExtended(db, {
      tenantId: PAYING_TENANT,
      subscriptionStatus: "past_due",
      subscriptionMap: {
        status: "past_due",
        pastDueSince: daysAgoIso(PAST_DUE_GRACE_DAYS - 2),
      },
      userId: USER_ADMIN_BETA.uid,
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    await page.goto("/subscription-blocked");
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });
});

// ─── SB-07 / SB-08: Past_due outside grace / no pastDueSince ────────────────

test.describe("AUTH-SB-07/08: Expired or missing pastDueSince stays on /subscription-blocked", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, PAYING_TENANT);
  });

  test("past_due outside grace period → /subscription-blocked renders", async ({ page }) => {
    await seedBillingStateExtended(db, {
      tenantId: PAYING_TENANT,
      subscriptionStatus: "past_due",
      subscriptionMap: {
        status: "past_due",
        pastDueSince: daysAgoIso(PAST_DUE_GRACE_DAYS + 2),
      },
      userId: USER_ADMIN_BETA.uid,
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/\/(subscription-blocked|login)/, { timeout: 15000 });

    await page.goto("/subscription-blocked");
    await expect(page).toHaveURL(/\/subscription-blocked/, { timeout: 10000 });
  });

  test("past_due without pastDueSince → /subscription-blocked renders (fail-closed)", async ({ page }) => {
    // Seed past_due with no pastDueSince — should be treated as expired
    await seedBillingStateExtended(db, {
      tenantId: PAYING_TENANT,
      subscriptionStatus: "past_due",
      subscriptionMap: { status: "past_due" },
      userId: USER_ADMIN_BETA.uid,
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/\/(subscription-blocked|login)/, { timeout: 15000 });

    await page.goto("/subscription-blocked");
    await expect(page).toHaveURL(/\/subscription-blocked/, { timeout: 10000 });
  });
});
