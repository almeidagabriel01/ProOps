/**
 * MOBILE-EMPRESA-01: quatro defeitos do site da empresa relatados num iPhone.
 *
 * Todos passavam no `superficies-layout.spec.ts`, porque nenhum deles vaza na
 * horizontal: um card cortado pelo palco `overflow-hidden` não aumenta o
 * `scrollWidth`, e um aparelho apagado é um aparelho que está lá. A régua aqui
 * é o que o leitor vê.
 *
 * 1. O "Conhecer o aplicativo" do herói esticava na coluna e centralizava o
 *    texto, desalinhado do botão acima e do texto da página.
 * 2. Em "O problema", as planilhas espalhadas em `vw`/`vh` fixos saíam da tela
 *    e cobriam o próprio sobrescrito da seção.
 * 3. A cena lateral dos dois produtos só existia do `md` para cima.
 * 4. Em /produtos, o primeiro aparelho empilhado só ficava visível depois de
 *    passar pela tela inteira apagado, porque os três dividiam um relógio
 *    medido na coluna inteira.
 *
 * Os tamanhos cobrem o iPhone 17 Pro, um Android comum, o iPhone SE e um
 * celular curto, que é onde a cena lateral volta a empilhar de propósito.
 */

import { test, expect, type Page } from "@playwright/test";

const PORTA = process.env.E2E_PORT ?? 3001;
const APEX = `http://proops.localhost:${PORTA}`;

const APARELHOS = [
  { nome: "iPhone 17 Pro", largura: 402, altura: 874 },
  { nome: "Android 360", largura: 360, altura: 740 },
  { nome: "iPhone SE", largura: 375, altura: 667 },
  { nome: "celular curto", largura: 360, altura: 560 },
];

/** Topo de um elemento no documento, e não na janela. */
async function topoNoDocumento(page: Page, seletor: string) {
  return page.evaluate(
    (s) => document.querySelector(s)!.getBoundingClientRect().top + scrollY,
    seletor,
  );
}

/**
 * Rola e espera a cena assentar. As cenas com `scrub` perseguem a rolagem com
 * atraso (0,6s), e o ScrollTrigger delas só nasce quando o IntersectionObserver
 * vê a seção, então o tempo aqui é de propósito folgado.
 */
async function rolarPara(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await page.waitForTimeout(1200);
}

for (const aparelho of APARELHOS) {
  test.describe(`MOBILE-EMPRESA-01: ${aparelho.nome}`, () => {
    test.use({
      viewport: { width: aparelho.largura, height: aparelho.altura },
    });

    test("o link do aplicativo, no herói, alinha à esquerda com o botão do ERP", async ({
      page,
    }) => {
      await page.goto(`${APEX}/`);
      await page.waitForLoadState("networkidle");

      const heroi = page.locator('section[aria-label="ProOps"]');
      const erp = heroi.getByRole("link", { name: "Conhecer o ERP" });
      const app = heroi.getByRole("link", { name: "Conhecer o aplicativo" });
      await expect(app).toBeVisible();

      const caixaErp = (await erp.boundingBox())!;
      const caixaApp = (await app.boundingBox())!;
      expect(Math.abs(caixaApp.x - caixaErp.x)).toBeLessThanOrEqual(1);
      // Esticado na coluna, ele tinha a largura da coluna inteira.
      expect(caixaApp.width).toBeLessThan(aparelho.largura * 0.7);
    });

    test("em 'O problema', as planilhas ficam na tela e não cobrem o sobrescrito", async ({
      page,
    }) => {
      await page.goto(`${APEX}/`);
      await page.waitForLoadState("networkidle");

      const seletor = 'section[aria-label="O problema"]';
      const topo = await topoNoDocumento(page, seletor);
      const secao = page.locator(seletor);
      const sobrescrito = secao.getByText("O problema", { exact: true });

      // Do início, espalhado, até a metade da reunião.
      for (const fracao of [0.02, 0.15, 0.3]) {
        await rolarPara(page, topo + fracao * 2 * aparelho.altura);

        const medida = await page.evaluate((s) => {
          const palco = document.querySelector(s)!;
          const rotulo = [...palco.querySelectorAll("p")].find(
            (p) => p.textContent?.trim() === "O problema",
          )!;
          const r = rotulo.getBoundingClientRect();
          const noCentro = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2,
          );
          const cards = [
            ...palco.querySelectorAll<HTMLElement>(
              ".w-\\[var\\(--largura-planilha\\)\\]",
            ),
          ].map((c) => {
            const b = c.getBoundingClientRect();
            return { esquerda: b.left, direita: b.right };
          });
          return {
            rotuloVisivel: !!noCentro && rotulo.contains(noCentro),
            cards,
            janela: innerWidth,
          };
        }, seletor);

        expect(medida.cards).toHaveLength(6);
        expect(
          medida.rotuloVisivel,
          `o sobrescrito está coberto em ${fracao}`,
        ).toBe(true);
        for (const card of medida.cards) {
          expect(card.esquerda, `card cortado à esquerda em ${fracao}`).toBeGreaterThanOrEqual(0);
          expect(card.direita, `card cortado à direita em ${fracao}`).toBeLessThanOrEqual(
            medida.janela,
          );
        }
      }
      await expect(sobrescrito).toBeVisible();
    });

    test("os dois produtos: cena lateral onde cabe, empilhados onde não cabe", async ({
      page,
    }) => {
      await page.goto(`${APEX}/`);
      await page.waitForLoadState("networkidle");

      const topo = await topoNoDocumento(page, "#produtos");
      const altura = await page.evaluate(
        () => document.getElementById("produtos")!.offsetHeight,
      );
      const cabe = aparelho.altura >= 620;

      if (!cabe) {
        // Curto demais para um painel caber numa tela: empilhado, e nada
        // desloca na horizontal.
        await rolarPara(page, topo + aparelho.altura);
        const esquerdas = await page
          .locator("#produtos article")
          .evaluateAll((els) =>
            els.map((e) => Math.round(e.getBoundingClientRect().left)),
          );
        expect(esquerdas).toEqual([0, 0]);
        return;
      }

      // Duas telas de altura: a segunda é a rolagem que faz a câmera andar.
      expect(Math.abs(altura - 2 * aparelho.altura)).toBeLessThanOrEqual(2);

      await rolarPara(page, topo);
      const antes = await page
        .locator("#produtos article")
        .evaluateAll((els) =>
          els.map((e) => Math.round(e.getBoundingClientRect().left)),
        );
      expect(antes[0]).toBe(0);
      expect(antes[1]).toBeGreaterThanOrEqual(aparelho.largura - 1);

      await rolarPara(page, topo + aparelho.altura);
      const depois = await page.evaluate(() => {
        const [primeiro, segundo] = [
          ...document.querySelectorAll("#produtos article"),
        ].map((e) => e.getBoundingClientRect());
        const botao = [...document.querySelectorAll("#produtos article a")][1]
          .getBoundingClientRect();
        return {
          primeiroDireita: Math.round(primeiro.right),
          segundoEsquerda: Math.round(segundo.left),
          botaoBase: botao.bottom,
          janela: innerHeight,
        };
      });
      expect(depois.primeiroDireita).toBeLessThanOrEqual(1);
      expect(Math.abs(depois.segundoEsquerda)).toBeLessThanOrEqual(1);
      // O painel inteiro cabe na tela, com o botão incluído.
      expect(depois.botaoBase).toBeLessThanOrEqual(depois.janela);
    });

    test("em /produtos, o primeiro aparelho do aplicativo já está visível quando chega", async ({
      page,
    }) => {
      await page.goto(`${APEX}/produtos`);
      await page.waitForLoadState("networkidle");

      const seletor = 'section[aria-label="O aplicativo por dentro"] figure';
      const topo = await topoNoDocumento(page, seletor);

      // Chega de longe, como o leitor, para o ScrollTrigger nascer antes.
      await rolarPara(page, topo - 2 * aparelho.altura);
      await rolarPara(page, topo - aparelho.altura * 0.35);

      const opacidade = await page.evaluate(
        (s) => Number(getComputedStyle(document.querySelector(s)!).opacity),
        seletor,
      );
      expect(opacidade).toBeGreaterThan(0.95);
    });
  });
}
