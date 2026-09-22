/**
 * LANDING-CENA-01: a cena da planta, na landing do ERP.
 *
 * A cena mora em `components/marketing/cena-planta/` e substituiu o carrossel
 * de vídeos "Conheça a plataforma ProOps". Os testes unitários provam o roteiro
 * como função pura, a projeção contra a câmera do three e a ordem de desenho; o
 * que só o navegador prova é o encadeamento: que a rolagem de verdade chega a
 * cada ato, que cada ato mostra o que diz, que trocar o nicho reescreve a
 * proposta, e que nada disso custa o orçamento do celular.
 *
 * A rolagem é SEMPRE por roda (`page.mouse.wheel`). `window.scrollTo` move a
 * página sem passar pelo Lenis, que é quem chama `ScrollTrigger.update`: a cena
 * ficaria congelada no ato anterior e o teste mediria a ferramenta errada.
 */

import { test, expect, type Page } from "@playwright/test";

const PORTA = process.env.E2E_PORT ?? 3001;
// `localhost` serve a landing do ERP: a virada mandou só o apex para a
// institucional (`surfaces.ts`).
const ERP = `http://localhost:${PORTA}`;

const CENA = "[data-cena-planta]";

/** Rola por roda até a cena chegar ao ato pedido. */
async function rolaAte(page: Page, ato: string) {
  for (let i = 0; i < 160; i++) {
    const atual = await page.locator(CENA).getAttribute("data-ato");
    if (atual === ato) return;
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(80);
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
  test.describe(`LANDING-CENA-01: os atos da cena (${tela.nome})`, () => {
    test.use({ viewport: tela.viewport });

    test("a rolagem leva do projeto ao financeiro, e cada ato mostra o que diz", async ({
      page,
    }) => {
      await page.goto(`${ERP}/`);
      await page.waitForLoadState("networkidle");

      await expect(page.locator(CENA)).toHaveAttribute("data-ato", "repouso");

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

      // O fim da história é o financeiro, e não o aplicativo: esta página vende
      // o ERP. O ato começa quando a divisão COMEÇA a entrar, então a rolagem
      // segue até o fim da trilha antes de medir.
      await rolaAte(page, "financeiro");
      for (let i = 0; i < 12; i++) {
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(80);
      }
      await expect
        .poll(() => opacidade(page, ".cena-divisao"), { timeout: 4000 })
        .toBeGreaterThan(0.9);
      await expect(page.locator(".cena-divisao")).toContainText("12.400,00");
      await expect(page.locator(".cena-divisao")).toContainText("6.200,00");
      await semVazamento(page);
    });
  });
}

test.describe("LANDING-CENA-01: o nicho do exemplo", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("trocar o nicho reescreve os itens da proposta, sem remontar a cena", async ({
    page,
  }) => {
    await page.goto(`${ERP}/`);
    await page.waitForLoadState("networkidle");

    // Os três rótulos de cada item estão SEMPRE no HTML, e o CSS mostra o do
    // nicho ativo: por isso a asserção é de visibilidade, e não de texto
    // (`toContainText` lê `textContent`, que enxerga o que está escondido).
    const folha = page.locator("[data-folha]");
    const rotulo = (nicho: string) => folha.locator(`[data-rotulo-de="${nicho}"]`).first();
    const abas = page.getByRole("group", { name: "Nicho do exemplo" });

    await rolaAte(page, "proposta");
    await expect(rotulo("automacao")).toBeVisible();
    await expect(rotulo("marcenaria")).toBeHidden();

    await abas.getByRole("button", { name: "Marcenaria" }).click();
    await expect(rotulo("marcenaria")).toBeVisible();
    await expect(rotulo("marcenaria")).toHaveText("Armário planejado");
    await expect(rotulo("automacao")).toBeHidden();

    await abas.getByRole("button", { name: "Cortinas e decoração" }).click();
    await expect(rotulo("cortinas")).toHaveText("Cortina blackout, trilho motorizado");
    // A conta não muda com o nicho: o que troca é o vocabulário.
    await expect(page.locator("[data-folha] li").first()).toContainText("6.850,00");
  });
});

test.describe("LANDING-CENA-01: orçamento do celular", () => {
  test.use({ viewport: { width: 412, height: 823 } });

  test("a 412px o three.js nunca é pedido, e a casa é o SVG do servidor", async ({
    page,
  }) => {
    await page.goto(`${ERP}/`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => typeof (window as { __THREE__?: string }).__THREE__)).toBe(
      "undefined",
    );
    await expect(page.locator("[data-casa] canvas")).toHaveCount(0);
    await expect(page.locator("[data-casa] svg[data-planta]")).toHaveCount(1);
  });
});

test.describe("LANDING-CENA-01: movimento reduzido", () => {
  test("a cena é o quadro final, no fluxo, sem precisar rolar", async ({ browser }) => {
    // `contextOptions`, e não `test.use({ reducedMotion })`: por `test.use` a
    // preferência não chegava à página neste projeto.
    const contexto = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await contexto.newPage();
    await page.goto(`${ERP}/`);
    await page.waitForLoadState("networkidle");

    const altura = await page.locator(CENA).evaluate((el) => el.getBoundingClientRect().height);
    // Sem a trilha de 300vh: a cena tem a altura do que ela mostra.
    expect(altura).toBeLessThan(800 * 3);

    await expect(page.locator("[data-folha]")).toContainText("0018926SP");
    await expect(page.locator("[data-total]")).toHaveText(/31\.000,00/);
    expect(await opacidade(page, ".cena-divisao")).toBeGreaterThan(0.99);
    expect(await opacidade(page, ".cena-selo")).toBeGreaterThan(0.99);
    await expect(page.locator("[data-casa][data-webgl]")).toHaveCount(0);
    await contexto.close();
  });
});
