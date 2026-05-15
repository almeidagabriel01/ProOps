/**
 * Phase 20 — Subscription State Banners + Cancel Enforcement (E2E stubs).
 *
 * Wave 0 stubs declared by Plan 20-01. Tests use the new seedBillingStateExtended
 * helper to put tenant-beta into past_due / cancelAtPeriodEnd states and verify the
 * banner UI in ProtectedAppShell. The UI banners are implemented by Plan 20-03;
 * until then these tests fail closed (banner element not found) — that is intended
 * for Nyquist-compliant feedback sampling.
 *
 * Grep strings (from 20-VALIDATION.md):
 *   - "past_due banner"             → STATE-01
 *   - "cancel period end banner"    → STATE-02
 *   - "cancel subscription past_due"→ STATE-03
 */

import { test, expect } from "../fixtures/base.fixture";
import { getTestDb } from "../helpers/admin-firestore";
import { seedBillingStateExtended, restoreTenantState } from "../seed/data/billing";
import { USER_ADMIN_BETA } from "../seed/data/users";

const TENANT = "tenant-beta";

test.describe("STATE-01 past_due banner", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, TENANT);
  });

  test("past_due banner: red banner visible at top of dashboard with 'Atualizar pagamento' CTA", async ({ page, loginPage }) => {
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "past_due",
      subscriptionMap: {
        status: "past_due",
        pastDueSince: new Date().toISOString(),
      },
      userId: USER_ADMIN_BETA.uid,
    });

    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 30000 });

    const banner = page.getByTestId("billing-state-banner-past-due");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner.getByRole("button", { name: /Atualizar pagamento/i })).toBeVisible();
  });
});

test.describe("STATE-02 cancel period end banner", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, TENANT);
  });

  test("cancel period end banner: yellow banner visible with formatted date", async ({ page, loginPage }) => {
    // Use noon UTC so that in America/Sao_Paulo (UTC-3) the date is still 15/06
    // — formatDateBR renders in BR timezone, so a midnight-UTC seed would land
    // at 21:00 on 14/06 BRT and render as "14/06/2026", breaking the assertion.
    const cancelAtIso = "2026-06-15T12:00:00.000Z";
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      subscriptionMap: {
        status: "active",
        cancelAtPeriodEnd: true,
        cancelAt: cancelAtIso,
      },
      userId: USER_ADMIN_BETA.uid,
    });

    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 30000 });

    const banner = page.getByTestId("billing-state-banner-cancel-period-end");
    await expect(banner).toBeVisible({ timeout: 10000 });
    // Date should appear formatted as BR (e.g., "15/06/2026")
    await expect(banner).toContainText(/15\/06\/2026/);
  });
});

test.describe("STATE-03 cancel subscription past_due", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, TENANT, USER_ADMIN_BETA.uid);
  });

  test("cancel subscription past_due: AlertDialog shows immediate-cancel warning copy", async ({ page, loginPage }) => {
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "past_due",
      subscriptionMap: {
        status: "past_due",
        pastDueSince: new Date().toISOString(),
      },
      userId: USER_ADMIN_BETA.uid,
      stripeSubscriptionId: "sub_test_past_due",
    });

    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 30000 });
    await page.goto("/profile");

    // Wait for the subscription tab to render before clicking — the page
    // settles auth/billing state asynchronously on entry.
    await page
      .getByRole("button", { name: /Cancelar Assinatura/i })
      .waitFor({ state: "visible", timeout: 30000 });

    // Profile cancel button — opens the AlertDialog branch.
    await page.getByRole("button", { name: /Cancelar Assinatura/i }).click();

    // Past_due-specific dialog body — UI-SPEC locked copy.
    await expect(
      page.getByText(/Você está com pagamento pendente\. Ao cancelar, seu acesso será encerrado imediatamente\./i),
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Sim, cancelar agora/i })).toBeVisible();
  });
});
