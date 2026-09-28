import { test, expect } from "@playwright/test";
import { coletaErrosDeHidratacao } from "../helpers/erros-de-hidratacao";

/**
 * FUNCIONALIDADES: a lista do que o ERP faz e a página de cada funcionalidade.
 *
 * O conteúdo (qual recurso pertence a qual funcionalidade, os selos de plano)
 * tem os próprios testes de unidade em
 * `apps/web/src/lib/landing/funcionalidades/__tests__`. Aqui o que se mede é o
 * que só um navegador vê: a lista abre sem sessão, cada linha leva à página
 * certa (inclusive clicando fora do título), a home e as landings de nicho
 * levam às mesmas páginas, um slug inventado é 404 e nada disso tem erro de
 * hidratação.
 */

const TOTAL_DE_FUNCIONALIDADES = 15;

test.describe("FUNCIONALIDADES: a lista", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("abre sem login, com uma linha por funcionalidade e o plano de cada uma", async ({ page }) => {
    await page.goto("/funcionalidades");
    await expect(page).toHaveURL(/\/funcionalidades$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tudo o que a ProOps faz");
    const linhas = page.locator("main ol > li").filter({ has: page.locator('a[href^="/funcionalidades/"]') });
    await expect(linhas).toHaveCount(TOTAL_DE_FUNCIONALIDADES);
    const semPlano = await linhas.evaluateAll((els) =>
      els.filter((el) => !/plano|Profissional|Enterprise|Starter/.test(el.textContent ?? "")).length,
    );
    expect(semPlano).toBe(0);
  });

  test("clicar na linha, fora do título, abre a página da funcionalidade", async ({ page }) => {
    await page.goto("/funcionalidades");
    const linha = page.locator("main ol > li").filter({ has: page.getByRole("link", { name: "Financeiro", exact: true }) });
    // O título cobre a linha com um ::after, então é ele que recebe o clique
    // dado sobre a explicação; `force` pula a checagem de alvo do Playwright,
    // que esperaria o próprio parágrafo receber o evento.
    await linha.getByText("Você só dá baixa").click({ force: true });
    await expect(page).toHaveURL(/\/funcionalidades\/financeiro$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("O financeiro nasce da venda");
  });

  test("a navbar leva à lista e marca o item", async ({ page }) => {
    await page.goto("/decoracao");
    const link = page.getByRole("navigation").getByRole("link", { name: "Funcionalidades" }).first();
    await expect(link).toHaveAttribute("href", "/funcionalidades");
    await page.goto("/funcionalidades");
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Funcionalidades" }).first(),
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("FUNCIONALIDADES: a página de cada uma", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("mostra como funciona e os recursos incluídos, cada um com o plano", async ({ page }) => {
    await page.goto("/funcionalidades/financeiro");
    await expect(page.getByRole("heading", { name: /Como funciona/ })).toBeVisible();
    for (const id of ["lancamentos", "carteiras", "comissoes", "painel"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator("#lancamentos")).toContainText("Profissional");
    await page.getByRole("link", { name: "Todas as funcionalidades", exact: true }).click();
    await expect(page).toHaveURL(/\/funcionalidades$/);
  });

  test("os exemplos abertos aparecem na página que os reúne", async ({ page }) => {
    await page.goto("/funcionalidades/pos-venda");
    await expect(
      page.locator("#portal-do-cliente").getByRole("link", { name: "Abrir o portal de exemplo" }),
    ).toHaveAttribute("href", "/share/portal/exemplo");
    await page.goto("/funcionalidades/fluxo-de-caixa-e-dre");
    await expect(
      page.locator("#link-do-contador").getByRole("link", { name: "Abrir o acesso de exemplo" }),
    ).toHaveAttribute("href", "/share/contador/exemplo");
  });

  test("slug fora da lista é 404", async ({ page }) => {
    const resposta = await page.goto("/funcionalidades/nao-existe");
    expect(resposta?.status()).toBe(404);
  });
});

test.describe("FUNCIONALIDADES: de onde se chega", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("um destaque da home abre a página dele", async ({ page }) => {
    await page.goto("/");
    const recursos = page.locator("#recursos");
    await recursos.scrollIntoViewIfNeeded();
    await recursos.getByRole("link", { name: "Pós-venda por link", exact: true }).click();
    await expect(page).toHaveURL(/\/funcionalidades\/pos-venda$/);
  });

  test("o bloco da plataforma numa landing de nicho abre a mesma página", async ({ page }) => {
    await page.goto("/decoracao");
    await page.getByRole("link", { name: "Saiba mais: O financeiro nasce da venda" }).click();
    await expect(page).toHaveURL(/\/funcionalidades\/financeiro$/);
  });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`FUNCIONALIDADES: hidratação (${reducedMotion})`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion } });

    for (const rota of ["/funcionalidades", "/funcionalidades/lia", "/funcionalidades/aceite-online"]) {
      test(`${rota} sem erro de hidratação`, async ({ page }) => {
        const erros = coletaErrosDeHidratacao(page);
        await page.goto(rota);
        await page.waitForLoadState("networkidle");
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(800);
        expect(erros).toEqual([]);
      });
    }
  });
}
