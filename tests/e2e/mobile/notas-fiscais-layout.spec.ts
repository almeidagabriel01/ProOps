import { test, expect } from "../fixtures/auth.fixture";
import {
  TOLERANCE_PX,
  describeOffenders,
  measureWhenSettled,
} from "./overflow-helpers";

/**
 * MOBILE-08 — Notas Fiscais cabe na largura do celular.
 *
 * O `/invoices` já estava na lista do MOBILE-01, mas lá o usuário é do tenant
 * `pro`, que não tem o módulo fiscal: a página mostrava o `UpgradeRequired` e
 * o cabeçalho de verdade nunca era medido. Foi assim que a tela passou meses
 * rolando de lado: o cabeçalho em linha que quebra deixava o bloco do título
 * crescer até a largura natural do seletor do Financeiro (~700px).
 *
 * Aqui entra o Enterprise, que abre o módulo e a recepção de notas (o segundo
 * seletor, Emitidas/Recebidas, também vive no cabeçalho). Sem notas emitidas a
 * lista fica vazia, mas o cabeçalho, que é o que vazava, é o mesmo.
 */
test("Notas Fiscais no Enterprise não vaza na horizontal", async ({
  planEnterprise: page,
}) => {
  await page.goto("/invoices");
  await page
    .locator("main#main-content")
    .waitFor({ state: "attached", timeout: 20000 });

  // Prova de que a tela real abriu, e não o convite de upgrade.
  await expect(
    page.getByRole("heading", { level: 1, name: "Notas Fiscais" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("group", { name: "Visões de Financeiro" }),
  ).toBeVisible();

  const report = await measureWhenSettled(page, "/invoices");
  expect(report.reachedRoute).toBe(true);
  expect(
    report.mainScrollWidth,
    `conteúdo do <main> mede ${report.mainScrollWidth}px numa área de ${report.mainClientWidth}px.${describeOffenders(report)}`,
  ).toBeLessThanOrEqual(report.mainClientWidth + TOLERANCE_PX);
  expect(report.docScrollWidth).toBeLessThanOrEqual(
    report.docClientWidth + TOLERANCE_PX,
  );

  // A visão ativa (Notas Fiscais, a sexta) também tem que estar à vista.
  const bar = page.getByRole("group", { name: "Visões de Financeiro" });
  await expect
    .poll(() =>
      bar.evaluate((el) => {
        const active = el.querySelector<HTMLElement>('[aria-pressed="true"]');
        if (!active) return false;
        const box = el.getBoundingClientRect();
        const item = active.getBoundingClientRect();
        return item.left >= box.left - 1 && item.right <= box.right + 1;
      }),
    )
    .toBe(true);
});
