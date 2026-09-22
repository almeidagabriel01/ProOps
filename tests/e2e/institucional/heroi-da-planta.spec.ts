/**
 * INSTITUCIONAL-04: o herói da raiz, a cena da planta ao dinheiro.
 *
 * Os testes unitários provam o roteiro como função pura (`roteiro.test.ts`),
 * a projeção contra a câmera do three (`projecao.test.ts`) e a ordem de desenho
 * (`desenho.test.ts`). O que só o navegador prova é o encadeamento: que o
 * diretor começa, que a rolagem de verdade chega a cada ato, que cada ato mostra
 * o que diz, e que nada disso vaza da tela ou custa o orçamento do celular.
 *
 * A rolagem é SEMPRE por roda (`page.mouse.wheel`). `window.scrollTo` move a
 * página sem passar pelo Lenis, que é quem chama `ScrollTrigger.update`: a cena
 * ficaria congelada no ato anterior e o teste mediria a ferramenta errada.
 */

import { test, expect, type Page } from "@playwright/test";

const PORTA = process.env.E2E_PORT ?? 3001;
const APEX = `http://proops.localhost:${PORTA}`;

const CENA = "section[data-cena-planta]";

/** Rola por roda até a cena chegar ao ato pedido. */
async function rolaAte(page: Page, ato: string) {
  for (let i = 0; i < 80; i++) {
    const atual = await page.locator(CENA).getAttribute("data-ato");
    if (atual === ato) return;
    await page.mouse.wheel(0, 160);
    await page.waitForTimeout(90);
  }
  await expect(page.locator(CENA)).toHaveAttribute("data-ato", ato);
}

/** Opacidade efetiva: a do elemento multiplicada pela de cada ancestral. */
async function opacidade(page: Page, seletor: string): Promise<number> {
  return page.locator(seletor).first().evaluate((el) => {
    let total = 1;
    for (let atual: Element | null = el; atual; atual = atual.parentElement) {
      total *= Number(getComputedStyle(atual).opacity);
    }
    return total;
  });
}

async function semVazamento(page: Page) {
  const [largura, janela] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(largura).toBeLessThanOrEqual(janela + 1);
}

for (const tela of [
  { nome: "desktop", viewport: { width: 1280, height: 800 } },
  { nome: "celular", viewport: { width: 393, height: 852 } },
]) {
  test.describe(`INSTITUCIONAL-04: os atos da cena (${tela.nome})`, () => {
    test.use({ viewport: tela.viewport });

    test("a rolagem leva do projeto ao dinheiro, e cada ato mostra o que diz", async ({
      page,
    }) => {
      await page.goto(`${APEX}/`);
      await page.waitForLoadState("networkidle");

      // Primeira dobra: o texto é o LCP e já está lá, sem esperar o diretor.
      await expect(page.locator(CENA)).toHaveAttribute("data-ato", "repouso");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.locator(CENA).getByRole("link", { name: "Conhecer o ERP" }),
      ).toBeVisible();

      await rolaAte(page, "projeto");
      await expect
        .poll(() => opacidade(page, '[data-chip="0"]'), { timeout: 4000 })
        .toBeGreaterThan(0.5);
      await semVazamento(page);

      await rolaAte(page, "proposta");
      await expect(page.locator("[data-folha]")).toContainText("0018926SP");
      await semVazamento(page);

      await rolaAte(page, "aprovada");
      await expect
        .poll(
          () =>
            page
              .locator(".cena-assinatura")
              .evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset)),
          { timeout: 4000 },
        )
        .toBeLessThan(0.1);
      await expect(page.locator("[data-total]")).toHaveText(/31\.000,00/);

      await rolaAte(page, "dinheiro");
      await expect
        .poll(() => opacidade(page, ".cena-mensagem"), { timeout: 4000 })
        .toBeGreaterThan(0.9);
      await expect(page.locator(".cena-mensagem")).toContainText("12.400,00");
      await semVazamento(page);

      // A cena devolve a página: a seção seguinte chega à tela.
      const seguinte = page.locator('section[aria-label="O que a ProOps faz"]');
      for (let i = 0; i < 40 && !(await seguinte.evaluate((el) => el.getBoundingClientRect().top < innerHeight)); i++) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(90);
      }
      await expect(seguinte).toBeInViewport();
    });

    test("rolar a cena inteira não desloca layout", async ({ page }) => {
      await page.goto(`${APEX}/`);
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => {
        (window as unknown as { __cls: number }).__cls = 0;
        new PerformanceObserver((lista) => {
          for (const entrada of lista.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entrada.hadRecentInput) (window as unknown as { __cls: number }).__cls += entrada.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await rolaAte(page, "dinheiro");
      await page.waitForTimeout(600);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls).toBeLessThan(0.05);
    });
  });
}

test.describe("INSTITUCIONAL-04: orçamento do celular", () => {
  test.use({ viewport: { width: 412, height: 823 } });

  test("a 412px o three.js nunca é pedido, e a casa é o SVG do servidor", async ({
    page,
  }) => {
    await page.goto(`${APEX}/`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => typeof (window as { __THREE__?: string }).__THREE__)).toBe(
      "undefined",
    );
    await expect(page.locator("[data-casa] canvas")).toHaveCount(0);
    await expect(page.locator("[data-casa] svg[data-planta]")).toBeVisible();
  });
});

test.describe("INSTITUCIONAL-04: movimento reduzido", () => {
  test("o herói é o quadro final, no fluxo, sem precisar rolar", async ({ browser }) => {
    // `contextOptions`, e não `test.use({ reducedMotion })`: por `test.use` a
    // preferência não chegava à página neste projeto.
    const contexto = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await contexto.newPage();
    await page.goto(`${APEX}/`);
    await page.waitForLoadState("networkidle");

    const altura = await page.locator(CENA).evaluate((el) => el.getBoundingClientRect().height);
    // Sem a trilha de 300vh: a seção tem a altura do que ela mostra.
    expect(altura).toBeLessThan(800 * 3);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-folha]")).toContainText("0018926SP");
    await expect(page.locator("[data-total]")).toHaveText(/31\.000,00/);
    expect(await opacidade(page, ".cena-mensagem")).toBeGreaterThan(0.99);
    expect(await opacidade(page, ".cena-selo")).toBeGreaterThan(0.99);
    await expect(page.locator("[data-casa][data-webgl]")).toHaveCount(0);
    await contexto.close();
  });
});
