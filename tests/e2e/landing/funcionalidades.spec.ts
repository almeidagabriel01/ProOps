import { test, expect } from "@playwright/test";
import { coletaErrosDeHidratacao } from "../helpers/erros-de-hidratacao";
import { secaoViva } from "../helpers/secao-viva";

/**
 * FUNCIONALIDADES: a página que lista tudo o que o ERP faz.
 *
 * O conteúdo (recursos, selos de plano) tem os próprios testes de unidade em
 * `apps/web/src/lib/landing/funcionalidades/__tests__`. Aqui o que se mede é o
 * que só um navegador vê: a página abre sem sessão, o filtro esconde e mostra
 * linhas de verdade, a âncora de um recurso abre a linha dele, e as versões
 * animada e estática da jornada são escolhidas pelo CSS sem erro de
 * hidratação.
 */

test.describe("FUNCIONALIDADES: conteúdo e filtro", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("abre sem login, com o título e as nove áreas", async ({ page }) => {
    await page.goto("/funcionalidades");
    await expect(page).toHaveURL(/\/funcionalidades$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tudo o que a ProOps faz");
    await expect(page.locator("[data-capitulo]")).toHaveCount(9);
    const linhas = page.locator("[data-recurso]");
    expect(await linhas.count()).toBeGreaterThan(40);
    // Toda linha diz o plano que a libera.
    const semSelo = await linhas.evaluateAll((els) =>
      els.filter((el) => !el.querySelector(".selo")?.textContent?.trim()).map((el) => el.id),
    );
    expect(semSelo).toEqual([]);
  });

  test("a busca e o filtro por plano escondem as linhas que não casam", async ({ page }) => {
    await page.goto("/funcionalidades");
    const busca = page.getByRole("searchbox", { name: "Buscar recurso" });
    await busca.scrollIntoViewIfNeeded();
    await busca.fill("contador");
    await expect(page.locator("#link-do-contador")).toBeVisible();
    await expect(page.locator("#leads")).toBeHidden();

    await busca.fill("");
    await page.getByRole("radio", { name: "Starter" }).click();
    // O Starter não traz notas de entrada, nem como add-on.
    await expect(page.locator("#notas-de-entrada")).toBeHidden();
    // O financeiro entra no Starter como add-on, e a linha diz isso.
    await expect(page.locator("#lancamentos")).toBeVisible();
    await expect(page.locator("#lancamentos")).toHaveAttribute("data-por-addon", "");

    await page.getByRole("radio", { name: "Todos" }).click();
    await expect(page.locator("#notas-de-entrada")).toBeVisible();
  });

  test("uma âncora de recurso chega com a linha aberta", async ({ page }) => {
    await page.goto("/funcionalidades#portal-do-cliente");
    await expect(page.locator("#portal-do-cliente details")).toHaveAttribute("open", "");
    await expect(
      page.locator("#portal-do-cliente").getByRole("link", { name: "Abrir o portal de exemplo" }),
    ).toHaveAttribute("href", "/share/portal/exemplo");
  });

  test("a navbar leva à página e marca o item", async ({ page }) => {
    await page.goto("/decoracao");
    const link = page.getByRole("navigation").getByRole("link", { name: "Funcionalidades" }).first();
    await expect(link).toHaveAttribute("href", "/funcionalidades");
    await page.goto("/funcionalidades");
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Funcionalidades" }).first(),
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("FUNCIONALIDADES: jornada com movimento", () => {
  test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: "no-preference" } });

  test("versão animada no desktop, sem erro de hidratação", async ({ page }) => {
    const erros = coletaErrosDeHidratacao(page);
    await page.goto("/funcionalidades");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-jornada-versao="animada"]')).toBeVisible();
    await expect(page.locator('[data-jornada-versao="estatica"]')).toBeHidden();
    // O seletor é resolvido DENTRO da seção que hidrata, então vai sem o ancestral.
    await secaoViva(page, '[data-passo="0"]');
    expect(erros).toEqual([]);
  });
});

test.describe("FUNCIONALIDADES: menos movimento", () => {
  test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: "reduce" } });

  test("versão estática, sem erro de hidratação", async ({ page }) => {
    const erros = coletaErrosDeHidratacao(page);
    await page.goto("/funcionalidades");
    await page.waitForLoadState("networkidle");
    await expect(page.locator('[data-jornada-versao="estatica"]')).toBeVisible();
    await expect(page.locator('[data-jornada-versao="animada"]')).toBeHidden();
    expect(erros).toEqual([]);
  });
});
