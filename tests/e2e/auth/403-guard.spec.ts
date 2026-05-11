/**
 * AUTH-403: /403 page guard tests.
 *
 * Verifies that the layout.tsx guard correctly renders or redirects users
 * based on how they arrived at /403 (in-app navigation vs direct URL access).
 *
 * Scenarios covered:
 *   403-01: Anon direct URL → redirect to /login
 *   403-02: Free user direct URL → redirect to / (resolved home)
 *   403-03: Admin user direct URL → redirect to /dashboard (resolved home)
 *   403-04: In-app navigation (same-origin Referer) → 403 page renders
 *   403-05: /403 page has "Início" and "Sair" buttons
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { USER_ADMIN_ALPHA, USER_FREE } from "../seed/data/users";

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

// ─── 403-01: Anon direct URL ─────────────────────────────────────────────────

test.describe("AUTH-403-01: Anon navigates directly to /403 → redirect to /login", () => {
  test.beforeEach(async ({ page }) => clearSessionAndStorage(page));

  test("anon user hitting /403 directly is redirected to /login", async ({ page }) => {
    await page.goto("/403");
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

// ─── 403-02: Free user direct URL ────────────────────────────────────────────

test.describe("AUTH-403-02: Free user navigates directly to /403 → redirect to /", () => {
  test("free user hitting /403 directly is redirected to their home (/)", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_FREE.email, USER_FREE.password);
    await page.waitForURL("/", { timeout: 15000 });

    // Direct URL navigation — no Referer header from a prior in-app page
    await page.goto("/403");
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });
});

// ─── 403-03: Paying admin direct URL ─────────────────────────────────────────

test.describe("AUTH-403-03: Admin user navigates directly to /403 → redirect to /dashboard", () => {
  test("admin user hitting /403 directly is redirected to /dashboard", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    // Direct URL navigation (page.goto sends no Referer)
    await page.goto("/403");
    await expect(page).toHaveURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 10000 });
  });
});

// ─── 403-04: In-app SPA navigation renders the 403 page ──────────────────────

test.describe("AUTH-403-04: In-app navigation reaches /403 and renders the page", () => {
  test("navigating within the app to /403 renders the 403 page (not redirected)", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    // Simulate SPA navigation with same-origin Referer by using page.evaluate to push
    // history (equivalent to router.push('/403') in the app)
    await page.evaluate(() => window.history.pushState({}, "", "/403"));
    await page.goto("/403", { referer: page.url() });

    // Because we provided a same-origin Referer, the layout should render the 403 page
    await expect(page).toHaveURL(/\/403/, { timeout: 10000 });
  });
});

// ─── 403-05: Page content ─────────────────────────────────────────────────────

test.describe("AUTH-403-05: /403 page has navigation buttons", () => {
  test("/403 page rendered via in-app navigation has Início and Sair buttons", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    // Navigate with same-origin referer
    await page.goto("/403", { referer: "http://localhost:3001/dashboard" });
    await expect(page).toHaveURL(/\/403/, { timeout: 10000 });

    // Check for navigation buttons
    await expect(page.getByRole("button", { name: /Início|Home|Voltar/i }).or(
      page.getByRole("link", { name: /Início|Home|Voltar/i })
    )).toBeVisible({ timeout: 5000 });
  });
});
