import { test, expect } from "@playwright/test";
import { loginAsPlanMaster } from "../fixtures/auth.fixture";
import { getTestDb } from "../helpers/admin-firestore";
import { PLAN_ONBOARDING_MOBILE } from "../seed/data/plans";

/**
 * O tutorial no celular: abaixo de md o card nasce minimizado (ele cobriria
 * metade da tela), cabe na largura e não fica por baixo da tab bar nem do
 * botão da Lia. Usuário exclusivo deste arquivo.
 */

test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await getTestDb()
    .collection("users")
    .doc(PLAN_ONBOARDING_MOBILE.uid)
    .update({
      onboarding: {
        version: "core-v2",
        status: "active",
        completedStepIds: [],
        currentStepId: "dashboard",
        startedAt: new Date().toISOString(),
        welcomeSeenAt: new Date().toISOString(),
      },
    });
});

test("o tutorial nasce como pílula e abre sem vazar nem cobrir a tab bar", async ({
  page,
}) => {
  await loginAsPlanMaster(page, PLAN_ONBOARDING_MOBILE);
  const viewport = page.viewportSize()!;

  const pill = page.getByTestId("onboarding-pill");
  await expect(pill).toBeVisible();
  await expect(page.getByTestId("onboarding-card")).toHaveCount(0);

  await pill.click();
  const card = page.getByTestId("onboarding-card");
  await expect(card).toBeVisible();

  const cardBox = (await card.boundingBox())!;
  expect(cardBox.x).toBeGreaterThanOrEqual(0);
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(viewport.width + 1);

  const tabBar = page.getByTestId("mobile-tab-bar");
  const tabBox = (await tabBar.boundingBox())!;
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(tabBox.y + 1);

  // O botão da Lia fica fixo à direita, acima da tab bar: o card sobe acima
  // dele em vez de ter o canto (onde fica o botão de avançar) coberto.
  const liaBox = (await page.getByRole("button", { name: "Abrir Lia" }).boundingBox())!;
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(liaBox.y + 1);

  // E a pílula, quando minimizada, divide a linha com a Lia sem encostar nela.
  await card.getByRole("button", { name: "Minimizar o tutorial" }).click();
  const pillBox = (await pill.boundingBox())!;
  expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(liaBox.x);
  await pill.click();

  // O botão de avançar precisa estar dentro da tela, não cortado pelo teto de altura.
  const next = card.getByTestId("onboarding-next");
  await next.scrollIntoViewIfNeeded();
  await expect(next).toBeInViewport();
});
