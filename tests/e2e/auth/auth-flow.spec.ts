/**
 * Auth flow E2E tests — AUTH-01 through AUTH-04.
 *
 * AUTH-01: Login flow (valid credentials + invalid credentials)
 * AUTH-02: Session persistence after page reload
 * AUTH-03: Logout clears session and redirects to /login
 * AUTH-04: Custom claims in Firebase ID token (Node.js only, no browser)
 */

import { test, expect } from "../fixtures/auth.fixture";
import { LoginPage } from "../pages/login.page";
import { DashboardPage } from "../pages/dashboard.page";
import { USER_ADMIN_ALPHA, USER_MEMBER_ALPHA } from "../seed/data/users";
import { getIdTokenClaims } from "../helpers/firebase-auth-api";

// ─── AUTH-01: Login flow ──────────────────────────────────────────────────────

test.describe("AUTH-01: Login flow", () => {
  test("logs in with valid credentials and lands on authenticated route", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);

    // After successful login the app redirects to one of the main routes
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    // Login form should be gone
    await expect(loginPage.emailInput).not.toBeVisible();
  });

  test("shows error message for invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login("invalid@test.com", "wrongpassword");

    // Error message must appear
    await expect(loginPage.errorMessage).toBeVisible({ timeout: 8000 });

    // User stays on the login page
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── AUTH-02: Session persistence ────────────────────────────────────────────

test.describe("AUTH-02: Session persistence", () => {
  test("session persists after page reload", async ({ authenticatedPage: page }) => {
    await page.reload();

    // After reload the user should still be on an authenticated route — NOT redirected to /login
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─── AUTH-03: Logout ──────────────────────────────────────────────────────────

test.describe("AUTH-03: Logout", () => {
  test("logout clears session and redirects to login", async ({ authenticatedPage: page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.logout();

    // Should be on /login after logout
    await expect(page).toHaveURL(/\/login/);

    // __session cookie must be cleared
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "__session")).toBeUndefined();

    // Login form should be visible again
    const loginPage = new LoginPage(page);
    await expect(loginPage.emailInput).toBeVisible();
  });
});

// ─── AUTH-04: Custom claims (Node.js only) ────────────────────────────────────

test.describe("AUTH-04: Custom claims", () => {
  test("admin alpha token has correct claims", async () => {
    const claims = await getIdTokenClaims(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);

    expect(claims.tenantId).toBe("tenant-alpha");
    expect(claims.role).toBe("admin");
    expect(claims.masterId).toBe("user-admin-alpha");
  });

  test("member alpha token has correct role and masterId", async () => {
    const claims = await getIdTokenClaims(USER_MEMBER_ALPHA.email, USER_MEMBER_ALPHA.password);

    expect(claims.tenantId).toBe("tenant-alpha");
    expect(claims.role).toBe("member");
    expect(claims.masterId).toBe("user-admin-alpha");
  });
});
