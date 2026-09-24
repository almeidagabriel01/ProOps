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

/**
 * **A casa nunca passa por cima de texto, e nunca é cortada.**
 *
 * A cena foi desenhada numa tela de 1440x900, e cada tela menor achou um jeito
 * de quebrá-la. Num notebook de 768 a câmera, visitando um cômodo, arrastava o
 * desenho para cima das abas de nicho; o recuo da proposta levava a casa para
 * baixo da nota; e a lateral era decepada na borda do canvas. No celular a casa
 * subia para trás das abas, que são botões translúcidos, e aparecia através
 * delas.
 *
 * A medida é a de quem olha, e não a de caixas: pontos espalhados dentro das
 * abas, da nota e da legenda, e `elementsFromPoint` dizendo se debaixo de
 * algum deles há uma face ou aresta da casa. É o desenho SVG que responde,
 * inclusive no desktop, onde ele fica invisível sob o three.js: os dois são
 * desenhados pela mesma câmera, e o SVG é o único que o DOM sabe consultar. O
 * contorno para o corte são as arestas, e não o grupo da câmera, porque o
 * brilho do piso passa do contorno de propósito.
 *
 * A rolagem varre a cena inteira em passos curtos, porque as colisões eram de
 * instantes: um cômodo visitado, o meio de um recuo.
 */
const MEDE = () => {
  const palco = document.querySelector("[data-palco]")!.getBoundingClientRect();
  if (palco.bottom < window.innerHeight * 0.6) return { fim: true, ato: "", problemas: [], folha: null };
  const opacidade = (el: Element) => {
    let o = 1;
    for (let a: Element | null = el; a; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
    return o;
  };
  const casa = document.querySelector("[data-casa]")!;
  const problemas: string[] = [];
  if (opacidade(casa) > 0.15) {
    const seletor = document.querySelector("[data-seletor-de-nicho]");
    const textos: Record<string, Element | null | undefined> = {
      abas: seletor?.firstElementChild,
      nota: seletor?.lastElementChild,
      legenda: document.querySelector(".cena-legendas > div"),
      trilho: document.querySelector(".cena-legendas > ol"),
    };
    const ehDaCasa = (el: Element) =>
      el instanceof SVGGeometryElement && !!el.closest("[data-planta]");
    for (const [nome, el] of Object.entries(textos)) {
      if (!el || opacidade(el) < 0.15) continue;
      const b = el.getBoundingClientRect();
      let pontos = 0;
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 4; j++) {
          const x = b.left + (b.width * (i + 0.5)) / 9;
          const y = b.top + (b.height * (j + 0.5)) / 4;
          if (document.elementsFromPoint(x, y).some(ehDaCasa)) pontos++;
        }
      }
      if (pontos) problemas.push(`casa sobre ${nome} (${pontos} pontos)`);
    }
    const contorno = [...document.querySelectorAll("[data-planta] .planta-aresta")].reduce(
      (u, el) => {
        const r = el.getBoundingClientRect();
        return {
          left: Math.min(u.left, r.left),
          top: Math.min(u.top, r.top),
          right: Math.max(u.right, r.right),
          bottom: Math.max(u.bottom, r.bottom),
        };
      },
      { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
    const moldura = [palco];
    const canvas = document.querySelector("[data-casa] canvas");
    if (canvas) moldura.push(canvas.getBoundingClientRect());
    for (const m of moldura) {
      if (
        contorno.left < m.left - 1 ||
        contorno.right > m.right + 1 ||
        contorno.top < m.top - 1 ||
        contorno.bottom > m.bottom + 1
      ) {
        problemas.push(`casa cortada pela ${m === palco ? "borda do palco" : "borda do canvas"}`);
      }
    }
  }
  const f = document.querySelector("[data-folha]")!.getBoundingClientRect();
  return {
    fim: false,
    ato: document.querySelector("[data-cena-planta]")!.getAttribute("data-ato") ?? "",
    problemas,
    folha: { topo: f.top, base: f.bottom, palcoBase: palco.bottom },
  };
};

for (const tela of [
  { nome: "notebook 1366x768", viewport: { width: 1366, height: 768 }, celular: false },
  { nome: "notebook 1093x614", viewport: { width: 1093, height: 614 }, celular: false },
  { nome: "celular 417x760", viewport: { width: 417, height: 760 }, celular: true },
  { nome: "celular 360x740", viewport: { width: 360, height: 740 }, celular: true },
]) {
  test.describe(`LANDING-CENA-01: a casa e o texto (${tela.nome})`, () => {
    test.use({ viewport: tela.viewport, isMobile: tela.celular, hasTouch: tela.celular });

    test("a casa não passa por cima das abas, da nota nem da legenda, e não é cortada", async ({
      page,
    }) => {
      await page.goto(`${ERP}/`);
      await page.waitForLoadState("networkidle");
      await page.mouse.move(tela.viewport.width / 2, tela.viewport.height / 2);

      for (let i = 0; i < 80; i++) {
        const topo = await page.locator("[data-palco]").evaluate((el) => el.getBoundingClientRect().top);
        if (topo < 20) break;
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(60);
      }

      const problemas: string[] = [];
      let folhaNaAprovada: { topo: number; base: number; palcoBase: number } | null = null;
      for (let passo = 0; passo < 40; passo++) {
        // A rolagem passa por uma mola: medir antes de ela assentar mediria um
        // quadro que ninguém vê parado.
        await page.waitForTimeout(650);
        let r = await page.evaluate(MEDE);
        // Os 650ms bastam numa máquina de desenvolvimento e às vezes não no
        // runner do CI, mais lento: lá uma medição já pegou a casa ainda a
        // caminho do recuo, com 1 ponto sobre as abas, e a nova tentativa
        // passou. Uma colisão só conta se continuar lá com a mola parada.
        if (r.problemas.length) {
          await page.waitForTimeout(1200);
          r = await page.evaluate(MEDE);
        }
        if (r.fim) break;
        problemas.push(...r.problemas.map((p) => `${r.ato}: ${p}`));
        if (r.ato === "aprovada" && r.folha) folhaNaAprovada = r.folha;
        await page.mouse.wheel(0, Math.round(tela.viewport.height / 7));
      }

      expect(problemas).toEqual([]);

      // A proposta começa abaixo da barra fixa (uma cápsula de ~5rem), com o nome
      // do cliente e o código à vista, e não passa do fundo do palco.
      expect(folhaNaAprovada).not.toBeNull();
      if (folhaNaAprovada) {
        expect(folhaNaAprovada.topo).toBeGreaterThanOrEqual(64);
        expect(folhaNaAprovada.base).toBeLessThanOrEqual(folhaNaAprovada.palcoBase + 1);
      }
    });
  });
}

/**
 * **Celular.** Seis pílulas de item sobre uma casa de 345px se empilham umas
 * por cima das outras e cobrem a casa inteira, que foi o que se viu em
 * produção. No retrato cada item apaga quando o seguinte aparece.
 */
test.describe("LANDING-CENA-01: um item por vez no celular", () => {
  test.use({ viewport: { width: 393, height: 852 } });

  test("nunca há duas pílulas acesas ao mesmo tempo sobre a casa", async ({ page }) => {
    await page.goto(`${ERP}/`);
    await page.waitForLoadState("networkidle");
    await rolaAte(page, "projeto");

    // Durante o ato inteiro, e não num instante só: os itens surgem em
    // sequência, e o defeito era justamente o acúmulo.
    for (let passo = 0; passo < 14; passo++) {
      const acesas = await page.evaluate(() =>
        [...document.querySelectorAll(".cena-chip__rotulo")].filter((el) => {
          let opacidade = 1;
          for (let atual: Element | null = el; atual; atual = atual.parentElement) {
            opacidade *= Number(getComputedStyle(atual).opacity);
          }
          // O item que já pousou na proposta não conta: ele é linha, não pílula.
          const pilula = el.querySelector(".cena-chip__pilula");
          const visivel = pilula ? Number(getComputedStyle(pilula).opacity) : 0;
          return opacidade > 0.6 && visivel > 0.6;
        }).length,
      );
      // Uma, e não zero: a troca entre um item e o seguinte é um crossfade, e
      // no meio dele os dois existem. O que o defeito tinha eram SEIS pílulas
      // inteiras ao mesmo tempo.
      expect(acesas).toBeLessThanOrEqual(1);
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(120);
    }
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
