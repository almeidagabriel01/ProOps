/**
 * PROFILE-FREE: /profile page tests for free users.
 *
 * Verifies that:
 *   1. Free users can navigate to /profile without Firestore PERMISSION_DENIED errors.
 *   2. PlanUsageCard is NOT rendered for free users (no usage queries → no permission errors).
 *   3. PersonalForm and OrganizationForm are visible.
 *   4. Paying admin users still see PlanUsageCard (regression check).
 *
 * Bug repro:
 *   - Before fix: console showed "Error fetching tenant owner" and "Error fetching usage counts"
 *     (FirebaseError: Missing or insufficient permissions) for role=free.
 *   - After fix: no errors, PlanUsageCard hidden for free users.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { USER_ADMIN_ALPHA, USER_FREE } from "../seed/data/users";

// ─── PROFILE-FREE-01: No console errors for free user ────────────────────────

test.describe("PROFILE-FREE-01: Free user visits /profile with no Firestore permission errors", () => {
  test("free user on /profile → zero PERMISSION_DENIED errors in console", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_FREE.email, USER_FREE.password);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    // Navigate to /profile
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });

    // Wait for the page to settle
    await page.waitForTimeout(2000);

    const permissionErrors = consoleErrors.filter((e) =>
      e.includes("Missing or insufficient permissions") ||
      e.includes("PERMISSION_DENIED")
    );
    expect(permissionErrors).toEqual([]);
  });
});

// ─── PROFILE-FREE-02: PlanUsageCard hidden for free users ─────────────────────

test.describe("PROFILE-FREE-02: PlanUsageCard not rendered for free user", () => {
  test("free user on /profile → PlanUsageCard is not visible", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_FREE.email, USER_FREE.password);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });

    // Wait for page to load
    await page.waitForTimeout(1000);

    // PlanUsageCard should NOT be present for free users
    const planUsageCard = page.getByTestId("plan-usage-card");
    await expect(planUsageCard).toHaveCount(0);
  });
});

// ─── PROFILE-FREE-03: PersonalForm and OrganizationForm visible ───────────────

test.describe("PROFILE-FREE-03: Free user sees PersonalForm and OrganizationForm", () => {
  test("free user on /profile → forms are visible", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_FREE.email, USER_FREE.password);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });

    // PersonalForm has a name input or email field
    const nameInput = page.locator("input[name='name'], input[placeholder*='nome'], input[placeholder*='Nome']").first();
    await expect(nameInput.or(page.locator("input[name='email']"))).toBeVisible({ timeout: 8000 });
  });
});

// ─── PROFILE-FREE-04: Paying admin still sees PlanUsageCard ──────────────────

test.describe("PROFILE-FREE-04: Paying admin user sees PlanUsageCard on /profile (regression check)", () => {
  test("paying admin on /profile → PlanUsageCard is visible", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 15000 });

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });

    // PlanUsageCard should be present for paying users
    const planUsageCard = page.getByTestId("plan-usage-card");
    await expect(planUsageCard).toBeVisible({ timeout: 10000 });
  });
});

// ─── PROFILE-FREE-05: Free user sees their company name in header + profile ───
//
// Bug repro:
//   In read-only demo mode `tenant` points at the shared __demo__ dataset, so
//   useHeaderPresentation lazily reads the user's OWN tenant doc for display —
//   the real company name ("Free User's Tenant", seeded) must appear, never the
//   demo tenant's name.

test.describe("PROFILE-FREE-05: Free user sees their company name", () => {
  const EXPECTED_COMPANY = `${USER_FREE.name}'s Tenant`;

  test("free user → header shows the real company name (not the generic fallback)", async ({
    page,
  }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_FREE.email, USER_FREE.password);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    // Header must display the company name resolved from the tenant doc.
    await expect(page.getByText(EXPECTED_COMPANY).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("free user → /profile shows the real company name", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USER_FREE.email, USER_FREE.password);
    await expect(page).toHaveURL(/dashboard/, { timeout: 15000 });

    await page.goto("/profile");
    await expect(page).toHaveURL(/\/profile/, { timeout: 10000 });

    await expect(page.getByText(EXPECTED_COMPANY).first()).toBeVisible({
      timeout: 10000,
    });
  });
});
