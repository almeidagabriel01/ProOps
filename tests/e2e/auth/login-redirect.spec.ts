/**
 * AUTH-REDIRECT: Login redirect hardening tests (LOGIN-01).
 *
 * After Phase 22, the ?redirect= URL parameter is no longer consumed.
 * Every authenticated user lands on /dashboard (or /admin for superadmins)
 * regardless of URL parameters. The ?redirect_reason=session_expired param
 * is preserved — it triggers a warning toast on the /login page only.
 *
 * Scenarios covered:
 *   LR-01:      No redirect param → role-based home (admin & free → /dashboard)
 *   LR-06:      BUG REGRESSION — logout clears sticky redirect (free user never sent to /profile)
 *   LOGIN-01-A: ?redirect= is IGNORED (admin lands on /dashboard, superadmin on /admin)
 *   LOGIN-01-B: ?redirect_reason=session_expired → warning toast visible on /login
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import {
  USER_ADMIN_ALPHA,
  USER_FREE,
  USER_SUPERADMIN,
} from "../seed/data/users";

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
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // noop
    }
  });
}

// ─── LR-01: No redirect → role-based home ──────────────────────────────────

test.describe("AUTH-LR-01: Login without redirect param → role-based home", () => {
  test.beforeEach(async ({ page }) => clearSessionAndStorage(page));

  test("admin login without redirect lands on /dashboard", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
  });

  test("free user login without redirect lands on /dashboard (demo mode)", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_FREE.email, USER_FREE.password);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
  });
});

// ─── LR-06: Sticky redirect across logout ──────────────────────────────────

test.describe("AUTH-LR-06: Logout clears sticky redirect — free user never sent to /profile", () => {
  test.beforeEach(async ({ page }) => clearSessionAndStorage(page));

  test("paying user logs out from /profile; free user logs in → lands on /", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await page.waitForURL("/dashboard", { timeout: 15000 });

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });

    const logoutButton = page
      .getByRole("button", { name: /sair|logout|sign out/i })
      .first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      await page.goto("/login");
    }
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Wipe Firebase Auth persisted state from IndexedDB so the login page
    // renders the form immediately without a stale-session loading phase.
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
    await page.reload();

    await page
      .locator('#email[type="email"], input[type="email"]')
      .first()
      .waitFor({ state: "visible", timeout: 15000 });

    await loginPage.login(USER_FREE.email, USER_FREE.password);

    // Demo mode: free user lands on the ERP dashboard, and the sticky
    // /profile redirect from the previous session must NOT be honoured.
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/profile/);
  });
});

// ─── LOGIN-01-A: ?redirect= is ignored after login ─────────────────────────

test.describe("AUTH-LOGIN-01-A: Login ignores ?redirect= URL params", () => {
  test.beforeEach(async ({ page }) => clearSessionAndStorage(page));

  test("admin with ?redirect=/proposals → lands on /dashboard (redirect ignored)", async ({
    page,
  }) => {
    await page.goto("/login?redirect=%2Fproposals");
    const loginPage = new LoginPage(page);
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await expect(page).toHaveURL("/dashboard", { timeout: 15000 });
  });

  test("superadmin with ?redirect=/proposals → lands on /admin", async ({
    page,
  }) => {
    await page.goto("/login?redirect=%2Fproposals");
    const loginPage = new LoginPage(page);
    await loginPage.login(USER_SUPERADMIN.email, USER_SUPERADMIN.password);
    await expect(page).toHaveURL(/^.*\/admin(\/.*)?$/, { timeout: 15000 });
  });
});

// ─── LOGIN-01-B: Session-expired toast on /login ───────────────────────────

test.describe("AUTH-LOGIN-01-B: redirect_reason=session_expired shows warning toast", () => {
  test.beforeEach(async ({ page }) => clearSessionAndStorage(page));

  test("toast visible on /login when redirect_reason=session_expired is present", async ({
    page,
  }) => {
    await page.goto("/login?redirect_reason=session_expired");

    // Subtitle reverts to default — proves the conditional was removed
    await expect(
      page.getByText("Bem-vindo de volta! Insira suas credenciais."),
    ).toBeVisible({ timeout: 5000 });

    // Wait for Firebase Auth to finish initializing (isLoading → false).
    // The toast useEffect guards on !isLoading so it won't fire until the
    // email input is visible. Sileo renders toasts with data-sileo-toast.
    await page
      .locator('#email[type="email"], input[type="email"]')
      .first()
      .waitFor({ state: "visible", timeout: 15000 });

    const toast = page.locator("[data-sileo-toast]").first();
    await expect(toast).toBeVisible({ timeout: 5000 });
  });
});
