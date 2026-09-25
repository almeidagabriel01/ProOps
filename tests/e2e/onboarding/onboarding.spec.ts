import { test, expect, type Page } from "@playwright/test";
import { loginAsPlanMaster } from "../fixtures/auth.fixture";
import { getTestDb } from "../helpers/admin-firestore";
import { PLAN_ONBOARDING } from "../seed/data/plans";

/**
 * O tutorial de uma conta nova paga, ponta a ponta: boas-vindas, o card do
 * tour, sair e voltar pelo menu do perfil, e o card de primeiros passos.
 *
 * Usa um dono de conta exclusivo (PLAN_ONBOARDING) e roda em série: cada teste
 * reescreve `users/{uid}.onboarding` antes de entrar.
 */

test.describe.configure({ mode: "serial" });

async function resetOnboarding(extra: Record<string, unknown> = {}) {
  await getTestDb()
    .collection("users")
    .doc(PLAN_ONBOARDING.uid)
    .update({
      onboarding: {
        version: "core-v2",
        status: "active",
        completedStepIds: [],
        currentStepId: "dashboard",
        startedAt: new Date().toISOString(),
        ...extra,
      },
    });
}

async function savedOnboarding() {
  const snap = await getTestDb().collection("users").doc(PLAN_ONBOARDING.uid).get();
  return (snap.data()?.onboarding ?? {}) as Record<string, unknown>;
}

async function openUserMenuItem(page: Page, label: string) {
  await page.getByTestId("user-menu-trigger").click();
  await page.getByText(label, { exact: true }).click();
}

test.describe("Onboarding: conta nova paga", () => {
  test("boas-vindas, avançar, sair e retomar pelo menu", async ({ page }) => {
    await resetOnboarding();
    await loginAsPlanMaster(page, PLAN_ONBOARDING);

    const welcome = page.getByTestId("onboarding-welcome");
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText("Boas-vindas, Maria!");
    await page.getByTestId("onboarding-welcome-start").click();
    await expect(welcome).toBeHidden();

    const card = page.getByTestId("onboarding-card");
    await expect(card).toBeVisible();
    await expect(card.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(card).toContainText("Visão geral");

    await card.getByTestId("onboarding-next").click();
    await page.waitForURL(/\/proposals$/);
    await expect(card.getByRole("heading", { name: "Propostas" })).toBeVisible();
    await expect
      .poll(async () => (await savedOnboarding()).completedStepIds)
      .toEqual(["dashboard"]);

    // Rota aninhada continua sendo o passo de Propostas.
    await page.goto("/proposals/new");
    await expect(card.getByRole("heading", { name: "Propostas" })).toBeVisible();
    await expect(card).toContainText("Você está nesta tela agora.");

    await card.getByRole("button", { name: "Sair do tutorial" }).click();
    await expect(card).toBeHidden();
    await expect.poll(async () => (await savedOnboarding()).status).toBe("skipped");

    await openUserMenuItem(page, "Tutorial da plataforma");
    await page.waitForURL(/\/dashboard$/);
    await expect(card).toBeVisible();
    await expect(welcome).toBeHidden();
    await expect.poll(async () => (await savedOnboarding()).status).toBe("active");
  });

  test("o tour de um Pro cobre Comissões e Configurações, e não CRM nem Notas", async ({
    page,
  }) => {
    await resetOnboarding({ welcomeSeenAt: new Date().toISOString() });
    await loginAsPlanMaster(page, PLAN_ONBOARDING);

    const card = page.getByTestId("onboarding-card");
    await page.goto("/commissions");
    await expect(card.getByRole("heading", { name: "Comissões" })).toBeVisible();
    await page.goto("/settings/team");
    await expect(card.getByRole("heading", { name: "Equipe e permissões" })).toBeVisible();

    // CRM e Notas Fiscais não estão no Pro: fora do tour, o card oferece a
    // próxima tela pendente em vez de descrever a tela bloqueada.
    await page.goto("/crm");
    await expect(card).toContainText("Próxima tela do tour.");
  });

  test("minimizar vira pílula e sobrevive ao recarregar", async ({ page }) => {
    await resetOnboarding({ welcomeSeenAt: new Date().toISOString() });
    await loginAsPlanMaster(page, PLAN_ONBOARDING);

    await page.getByRole("button", { name: "Minimizar o tutorial" }).click();
    const pill = page.getByTestId("onboarding-pill");
    await expect(pill).toBeVisible();
    await page.reload();
    await expect(pill).toBeVisible();
    await pill.click();
    await expect(page.getByTestId("onboarding-card")).toBeVisible();
  });

  test("primeiros passos: tarefas pendentes, atalho e dispensar", async ({ page }) => {
    await resetOnboarding({
      welcomeSeenAt: new Date().toISOString(),
      status: "skipped",
    });
    await loginAsPlanMaster(page, PLAN_ONBOARDING);

    const firstSteps = page.getByTestId("first-steps-card");
    await expect(firstSteps).toBeVisible();
    for (const id of ["catalog", "contact", "proposal", "brand", "team"]) {
      await expect(page.getByTestId(`first-steps-task-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId("first-steps-task-proposal")).toHaveAttribute(
      "href",
      "/proposals/new",
    );

    await firstSteps.getByRole("button", { name: "Dispensar primeiros passos" }).click();
    await expect(firstSteps).toBeHidden();
    await expect
      .poll(async () => Boolean((await savedOnboarding()).firstStepsDismissedAt))
      .toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(firstSteps).toBeHidden();
  });
});
