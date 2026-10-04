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
import { USER_ADMIN_BETA, USER_MEMBER_BETA } from "../seed/data/users";

const TENANT = "tenant-beta";

test.describe("STATE-01 past_due banner", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, TENANT, USER_ADMIN_BETA.uid);
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
    await restoreTenantState(db, TENANT, USER_ADMIN_BETA.uid);
  });

  test("cancel period end banner: yellow banner visible with formatted date", async ({ page, loginPage }) => {
    // Use noon UTC so that in America/Sao_Paulo (UTC-3) the date is still 15/06
    // — formatDateBR renders in BR timezone, so a midnight-UTC seed would land
    // at 21:00 on 14/06 BRT and render as "14/06/2026", breaking the assertion.
    // A data vem do currentPeriodEnd da RAIZ do tenant, que é o que o webhook
    // grava: o subscription.cancelAt antigo nunca foi gravado em produção. Tem
    // que ser futura: cancelamento agendado com o período já encerrado bloqueia
    // a conta (SubscriptionGuard), e a faixa nunca apareceria.
    const periodEndDay = brDay(20);
    const periodEndIso = `${periodEndDay}T12:00:00.000Z`;
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEndIso,
      userId: USER_ADMIN_BETA.uid,
    });

    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 30000 });

    const banner = page.getByTestId("billing-state-banner-cancel-period-end");
    await expect(banner).toBeVisible({ timeout: 10000 });
    // Date should appear formatted as BR (dd/mm/aaaa)
    await expect(banner).toContainText(brLabel(periodEndDay));
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
    // Navigate directly to the subscription tab — the "Cancelar Assinatura" button
    // is rendered only inside <TabsContent value="subscription">. Without the tab
    // param the page defaults to "overview" and the button is never mounted.
    await page.goto("/profile?tab=subscription");

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

/** Dia em Brasília deslocado de hoje, no formato que o painel grava (YYYY-MM-DD). */
function brDay(offsetDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** pastDueSince que o cron grava: meia-noite de Brasília do dia seguinte ao fim. */
function pastDueSinceFor(endDay: string): string {
  const date = new Date(`${endDay}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.toISOString().slice(0, 10)}T03:00:00.000Z`;
}

function brLabel(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

test.describe("STATE-04 plano manual acabando", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, TENANT, USER_ADMIN_BETA.uid);
  });

  test("dono vê a faixa amarela com a data e o botão para falar com a ProOps", async ({ page, loginPage }) => {
    const end = brDay(7);
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "active",
      isManualSubscription: true,
      currentPeriodEnd: end,
      userId: USER_ADMIN_BETA.uid,
    });

    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 30000 });

    const banner = page.getByTestId("billing-state-banner-plan-expiring");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText(brLabel(end));
    await expect(banner.getByRole("button", { name: /Falar com a ProOps/i })).toBeVisible();
    // Contrato manual não oferece o portal do Stripe.
    await expect(page.getByTestId("billing-state-banner-past-due")).toHaveCount(0);
  });

  test("membro da mesma empresa não vê a faixa", async ({ page, loginPage }) => {
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "active",
      isManualSubscription: true,
      currentPeriodEnd: brDay(7),
      userId: USER_ADMIN_BETA.uid,
    });

    await loginPage.goto();
    await loginPage.login(USER_MEMBER_BETA.email, USER_MEMBER_BETA.password);
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30000 });
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId("billing-state-banner-plan-expiring")).toHaveCount(0);
  });
});

test.describe("STATE-05 plano manual vencido: carência de 7 dias", () => {
  const db = getTestDb();

  test.afterEach(async () => {
    await restoreTenantState(db, TENANT, USER_ADMIN_BETA.uid);
  });

  test("vencido há 2 dias continua navegando e vê a faixa vermelha com o fim da carência", async ({ page, loginPage }) => {
    const end = brDay(-2);
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "past_due",
      isManualSubscription: true,
      currentPeriodEnd: end,
      pastDueSince: pastDueSinceFor(end),
      userId: USER_ADMIN_BETA.uid,
    });

    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/(dashboard|proposals|transactions|contacts)/, { timeout: 30000 });

    const banner = page.getByTestId("billing-state-banner-plan-expired");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText(`O acesso continua até ${brLabel(brDay(5))}`);
    await expect(page).not.toHaveURL(/subscription-blocked/);
  });

  test("vencido há 9 dias é bloqueado", async ({ page, loginPage }) => {
    const end = brDay(-9);
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "past_due",
      isManualSubscription: true,
      currentPeriodEnd: end,
      pastDueSince: pastDueSinceFor(end),
      userId: USER_ADMIN_BETA.uid,
    });

    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/subscription-blocked/, { timeout: 30000 });
  });
});
