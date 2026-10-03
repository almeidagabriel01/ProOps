/**
 * A tela de quem perdeu o acesso: o que o dono e o membro leem e podem fazer,
 * no plano manual (dado pelo superadmin) e na assinatura Stripe, e que a
 * pessoa CONTINUA na tela, logada, em vez de ser mandada para o login.
 */
import * as admin from "firebase-admin";
import { test, expect } from "../fixtures/base.fixture";
import { getTestDb } from "../helpers/admin-firestore";
import { seedBillingStateExtended, restoreTenantState } from "../seed/data/billing";
import { USER_ADMIN_BETA, USER_MEMBER_BETA } from "../seed/data/users";

const TENANT = "tenant-beta";

function brDay(offsetDays: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function brLabel(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

test.describe.configure({ mode: "serial" });

test.describe("plano manual vencido", () => {
  const db = getTestDb();
  const end = brDay(-9);

  test.beforeEach(async () => {
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "canceled",
      isManualSubscription: true,
      currentPeriodEnd: end,
      userId: USER_ADMIN_BETA.uid,
    });
  });

  test.afterEach(async () => {
    await restoreTenantState(db, TENANT, USER_ADMIN_BETA.uid);
  });

  test("dono lê que o plano venceu, com a data, e só tem falar com a ProOps e sair", async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/subscription-blocked/, { timeout: 30000 });

    const card = page.getByTestId("subscription-blocked-card");
    await expect(card.getByText("Seu plano venceu", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText(`Seu plano venceu em ${brLabel(end)}. Para voltar a usar o ERP, fale com a ProOps para renovar.`);
    await expect(card.getByRole("button", { name: "Falar com a ProOps" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Sair da conta" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Renovar assinatura" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Atualizar pagamento" })).toHaveCount(0);

    // Continua na tela.
    await page.waitForTimeout(8000);
    await expect(page).toHaveURL(/subscription-blocked/);
    await expect(card).toBeVisible();
  });

  test("membro lê que a empresa está suspensa e com quem falar, e só pode sair", async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USER_MEMBER_BETA.email, USER_MEMBER_BETA.password);
    await page.waitForURL(/subscription-blocked/, { timeout: 30000 });

    const card = page.getByTestId("subscription-blocked-card");
    await expect(card).toContainText(
      "O acesso da empresa Beta Ltd ao ERP está suspenso. Fale com Admin Beta, responsável pela conta, para regularizar.",
      { timeout: 15000 },
    );
    await expect(card.getByRole("button")).toHaveCount(1);
    await expect(card.getByRole("button", { name: "Sair da conta" })).toBeVisible();

    await page.waitForTimeout(8000);
    await expect(page).toHaveURL(/subscription-blocked/);
  });
});

test.describe("assinatura Stripe com pagamento recusado (claims de cobrança no token)", () => {
  const db = getTestDb();
  const claimsBackup = new Map<string, Record<string, unknown>>();

  test.beforeEach(async () => {
    await seedBillingStateExtended(db, {
      tenantId: TENANT,
      subscriptionStatus: "canceled",
      stripeSubscriptionId: "sub_recusada",
      userId: USER_ADMIN_BETA.uid,
    });
    // Como o webhook grava: status e assinatura na raiz do tenant.
    await db
      .collection("tenants")
      .doc(TENANT)
      .set({ subscriptionStatus: "unpaid", stripeSubscriptionId: "sub_recusada" }, { merge: true });
    const auth = admin.app().auth();
    for (const who of [USER_ADMIN_BETA, USER_MEMBER_BETA]) {
      const original = (await auth.getUser(who.uid)).customClaims ?? {};
      claimsBackup.set(who.uid, original);
      await auth.setCustomUserClaims(who.uid, { ...original, subscriptionStatus: "unpaid" });
    }
  });

  test.afterEach(async () => {
    const auth = admin.app().auth();
    for (const [uid, claims] of claimsBackup) await auth.setCustomUserClaims(uid, claims);
    await restoreTenantState(db, TENANT, USER_ADMIN_BETA.uid);
  });

  test("dono vê renovar assinatura e continua logado na tela", async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USER_ADMIN_BETA.email, USER_ADMIN_BETA.password);
    await page.waitForURL(/subscription-blocked/, { timeout: 30000 });

    const card = page.getByTestId("subscription-blocked-card");
    await expect(card.getByText("Pagamento não aprovado", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(card.getByRole("button", { name: "Renovar assinatura" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Falar com a ProOps" })).toBeVisible();

    // Antes o front deslogava aqui (claim unpaid) e o próximo clique caía no
    // login. "Atualizar pagamento" só fica habilitado com a pessoa logada.
    await page.waitForTimeout(8000);
    await expect(page).toHaveURL(/subscription-blocked/);
    await expect(card.getByRole("button", { name: "Atualizar pagamento" })).toBeEnabled();
  });

  test("membro não vê botão de cobrança e continua na tela", async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(USER_MEMBER_BETA.email, USER_MEMBER_BETA.password);
    await page.waitForURL(/subscription-blocked/, { timeout: 30000 });

    const card = page.getByTestId("subscription-blocked-card");
    await expect(card.getByText("Acesso suspenso", { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(card.getByRole("button")).toHaveCount(1);

    await page.waitForTimeout(8000);
    await expect(page).toHaveURL(/subscription-blocked/);
  });
});
