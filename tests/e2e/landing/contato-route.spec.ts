/**
 * LANDING-CONTATO-01: /contato must be fully public.
 *
 * Bug: providers.tsx was missing /contato in isPublicMarketingPage, causing
 * the page to fall into the ProtectedRoute branch — showing the internal app
 * shell when logged in and redirecting to /login when logged out.
 *
 * These tests verify both the exact reported scenarios and their variants.
 */

import { test, expect } from "../fixtures/auth.fixture";

async function clearAuthState(page: import("@playwright/test").Page) {
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
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // ignore
    }
  });
}

test.describe("LANDING-CONTATO-01: /contato is fully public", () => {
  test("unauthenticated user can access /contato without redirect", async ({ page }) => {
    await clearAuthState(page);

    await page.goto("/contato");
    await page.waitForLoadState("networkidle");

    // Must stay on /contato — not redirected to /login
    await expect(page).toHaveURL(/\/contato/, { timeout: 10000 });

    // Form heading must be visible
    await expect(page.locator("h1")).toContainText("Fale com a gente");

    // ProtectedAppShell must NOT be mounted
    const dataShell = await page.evaluate(() => document.documentElement.dataset.shell);
    expect(dataShell).toBeUndefined();
  });

  test("unauthenticated user with query string stays on /contato", async ({ page }) => {
    await clearAuthState(page);

    await page.goto("/contato?utm_source=landing");
    await page.waitForLoadState("networkidle");

    // Must not redirect to /login?redirect=/contato
    await expect(page).toHaveURL(/\/contato/, { timeout: 10000 });
    expect(page.url()).not.toContain("/login");
  });

  test("authenticated user sees landing chrome on /contato, not app shell", async ({ authenticatedPage: page }) => {
    await page.goto("/contato");
    // Don't wait for networkidle — authenticated sessions on /contato still
    // load the root providers tree (including Firestore auth-state listeners
    // and other background queries) which never let the network go fully
    // idle. Wait for the page-specific heading instead.
    await page
      .locator("h1")
      .filter({ hasText: "Fale com a gente" })
      .waitFor({ state: "visible", timeout: 30000 });

    // Must stay on /contato
    await expect(page).toHaveURL(/\/contato/, { timeout: 10000 });

    // Form heading must be visible
    await expect(page.locator("h1")).toContainText("Fale com a gente");

    // ProtectedAppShell must NOT be mounted (data-shell is set only when shell is active)
    const dataShell = await page.evaluate(() => document.documentElement.dataset.shell);
    expect(dataShell).toBeUndefined();
  });
});
