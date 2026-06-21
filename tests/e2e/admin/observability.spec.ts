/**
 * OBSERVABILITY-01 / OBSERVABILITY-02: Admin observability dashboard access tests.
 *
 * OBSERVABILITY-01: Non-superadmin visiting /admin/observability is redirected to /403
 *                   (AdminGuard in layout.tsx pushes to /403 for non-superadmin roles).
 * OBSERVABILITY-02: Superadmin reaches the dashboard shell — heading "Observabilidade"
 *                   and "Issues abertas" metric label are visible without seeded data.
 */

import { test as uiTest, expect } from "../fixtures/base.fixture";
import { LoginPage } from "../pages/login.page";
import { USER_ADMIN_ALPHA, USER_SUPERADMIN } from "../seed/data/users";

uiTest.describe.configure({ mode: "serial" });

// ─── OBSERVABILITY-01: Non-superadmin is redirected away ─────────────────────

uiTest.describe("OBSERVABILITY-01: non-superadmin is redirected from /admin/observability", () => {
  uiTest(
    "regular admin visiting /admin/observability is redirected to /403",
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(USER_ADMIN_ALPHA.email, USER_ADMIN_ALPHA.password);
      await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, {
        timeout: 30000,
      });

      await page.goto("/admin/observability");
      await expect(page).toHaveURL(/\/403/, { timeout: 10000 });
    },
  );
});

// ─── OBSERVABILITY-02: Superadmin sees the dashboard shell ───────────────────

uiTest.describe("OBSERVABILITY-02: superadmin sees the observability dashboard shell", () => {
  uiTest(
    "superadmin visiting /admin/observability sees heading and Issues abertas label",
    async ({ page }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      await loginPage.login(USER_SUPERADMIN.email, USER_SUPERADMIN.password);
      await page.waitForURL(/\/admin/, { timeout: 30000 });

      await page.goto("/admin/observability");
      await expect(page.getByRole("heading", { name: "Observabilidade" })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("Issues abertas")).toBeVisible({ timeout: 10000 });
    },
  );
});
