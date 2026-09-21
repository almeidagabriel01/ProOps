/**
 * MOBILE-APP-01: a landing do aplicativo num celular de verdade.
 *
 * `mobile/superficies-layout.spec.ts` cobre o vazamento HORIZONTAL das sete
 * páginas de marketing. Este arquivo cobre o que aquele não vê, e que foi o que
 * de fato quebrou nesta página: conteúdo que cabe na largura, não cabe na
 * ALTURA, e some.
 *
 * Os três defeitos reais que motivaram cada teste daqui:
 *
 * 1. **O palco grudado transbordava.** O palco da leitura tem a altura do que
 *    sobra da tela (`100svh - 6rem`) e não corta nada: com a roda e a ficha nos
 *    tamanhos de desktop, a ficha terminava de 14 a 53px abaixo da borda num
 *    360x740, e de 24 a 42px num iPhone SE. Nada dava erro, nada vazava na
 *    horizontal, e a resposta que a cena inteira existe para mostrar ficava
 *    fora da tela.
 * 2. **A conversa nunca aparecia.** `#conversa` é dirigida pela rolagem, mas o
 *    palco dela só gruda de `md` para cima. No celular o intervalo do
 *    ScrollTrigger era quase zero, o progresso saltava de 0 a 1 em poucos
 *    pixels e as seis mensagens ficavam em `opacity: 0` em qualquer posição de
 *    rolagem. A seção respondia 200, tinha o texto no DOM e era invisível.
 * 3. **Alvos de toque menores que o dedo.** O botão "Repetir" tinha 26px de
 *    altura.
 *
 * Roda no projeto `mobile-chrome` (Pixel 5, `hasTouch`), com o viewport
 * sobreposto por teste: os dois tamanhos que pegaram os defeitos foram o
 * Android estreito (360x740) e o iPhone SE (375x667), e nenhum dos dois é o
 * Pixel 5.
 */

import { test, expect, type Page } from "@playwright/test";

/** A porta do servidor de teste, sobreponível (ver `superficies-layout.spec.ts`). */
const PORTA = process.env.E2E_PORT ?? 3001;

/** O host público desta superfície, e não o caminho interno do rewrite. */
const APP = `http://app.localhost:${PORTA}`;

/**
 * Os celulares que importam.
 *
 * O iPhone SE é o piso de ALTURA que ainda se vê em campo (667), e o Android de
 * 360 é o piso de LARGURA do projeto. O Pixel 5 é o aparelho do projeto do
 * Playwright, e está aqui para o caso de uma regressão só aparecer nele.
 */
const APARELHOS = [
  { nome: "iPhone SE", largura: 375, altura: 667 },
  { nome: "Android 360", largura: 360, altura: 740 },
  { nome: "Pixel 5", largura: 393, altura: 851 },
];

/** Quantas frases a roda tem: uma fatia de rolagem para cada. */
const FATIAS = 7;

/**
 * O palco grudado da leitura, e o quanto o conteúdo dele transborda.
 *
 * O palco gruda em `top: 96px` com `height: 100svh - 6rem`, então a borda de
 * baixo dele É a borda de baixo da tela. Logo, conteúdo que passa do palco é
 * conteúdo fora da tela, e `scrollHeight - clientHeight` é exatamente quanto.
 */
async function transbordoDoPalco(page: Page): Promise<number> {
  return page.evaluate(() => {
    const palco = [
      ...document.querySelectorAll<HTMLElement>("#comandos div"),
    ].find((el) => getComputedStyle(el).position === "sticky");
    if (!palco) throw new Error("o palco grudado da leitura não foi encontrado");
    return palco.scrollHeight - palco.clientHeight;
  });
}

/**
 * A opacidade de um elemento multiplicada pela dos ancestrais.
 *
 * `toBeVisible` do Playwright olha `display`, `visibility` e o tamanho da
 * caixa, e **não** olha opacidade: uma bolha em `opacity: 0` passa nele. Como
 * quem anima aqui é sempre um ancestral (a `motion.div` da bolha, não o
 * parágrafo), a conta precisa subir a árvore.
 */
async function opacidadeEfetiva(
  alvo: import("@playwright/test").Locator,
): Promise<number> {
  return alvo.evaluate((el) => {
    let total = 1;
    for (
      let no: HTMLElement | null = el as HTMLElement;
      no;
      no = no.parentElement
    ) {
      total *= Number(getComputedStyle(no).opacity);
    }
    return total;
  });
}

for (const aparelho of APARELHOS) {
  test.describe(`MOBILE-APP-01: ${aparelho.nome}`, () => {
    test.use({
      viewport: { width: aparelho.largura, height: aparelho.altura },
    });

    test("a leitura cabe na tela em todas as fatias", async ({ page }) => {
      await page.goto(`${APP}/`);
      await page.waitForLoadState("networkidle");

      // O trilho tem `100svh - 96px + 7 * 130svh`. Percorrer o meio de cada
      // fatia é ver as sete frases, que é onde a altura varia: a ficha tem de
      // dois a quatro campos conforme o pedido.
      await page.locator("#comandos").scrollIntoViewIfNeeded();

      const { topo, alcance } = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>("#comandos div[style]");
        if (!el) throw new Error("o trilho da leitura não foi encontrado");
        return {
          topo: el.getBoundingClientRect().top + window.scrollY - 96,
          alcance: el.offsetHeight - (window.innerHeight - 96),
        };
      });

      for (let fatia = 0; fatia < FATIAS; fatia += 1) {
        const em = (fatia + 0.5) / FATIAS;
        await page.evaluate(
          (y) => window.scrollTo({ top: y, behavior: "instant" }),
          topo + em * alcance,
        );
        // A cena é dirigida por uma mola: sem esperar, mede-se o quadro em que
        // a frase anterior ainda está saindo.
        await page.waitForTimeout(500);

        expect(
          await transbordoDoPalco(page),
          `fatia ${fatia + 1} transborda o palco`,
        ).toBeLessThanOrEqual(1);
      }
    });

    test("a conversa fica legível, sem depender do palco grudar", async ({
      page,
    }) => {
      await page.goto(`${APP}/`);
      await page.waitForLoadState("networkidle");

      const conversa = page.locator("#conversa");
      await conversa.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // A última mensagem é a que fecha a história (o limite voltando). Se o
      // progresso saltar, ela é a primeira a ficar para trás.
      const ultima = conversa.getByText("Limite devolvido", { exact: false });
      await expect(ultima).toBeVisible();
      expect(await opacidadeEfetiva(ultima)).toBeGreaterThan(0.9);

      // Os três beats ficam empilhados no celular, em vez de se revezarem no
      // mesmo lugar: dirigidos pela rolagem, dois deles ficariam em
      // `opacity: 0` por baixo do primeiro.
      for (const titulo of ["Ele responde", "E então", "Nada disso acontece"]) {
        const beat = conversa.getByRole("heading", {
          name: titulo,
          exact: false,
        });
        await expect(beat).toBeVisible();
        expect(
          await opacidadeEfetiva(beat),
          `o beat "${titulo}" está transparente`,
        ).toBeGreaterThan(0.9);
      }
    });

    test("os controles da seção de comandos são alcançáveis com o dedo", async ({
      page,
    }) => {
      await page.goto(`${APP}/`);
      await page.waitForLoadState("networkidle");

      const abas = page.getByRole("tablist", { name: "Operações de exemplo" });
      await abas.scrollIntoViewIfNeeded();

      // 36px é o piso que este projeto adota (`min-h-9`), abaixo do ideal de
      // 44 do iOS mas acima do que erra o toque. A régua é a ALTURA: as pílulas
      // e o "Repetir" são largos o bastante por natureza.
      const alvos = [
        abas.getByRole("tab").first(),
        page.getByRole("button", { name: "Repetir" }),
      ];
      for (const alvo of alvos) {
        const caixa = await alvo.boundingBox();
        expect(caixa, "o alvo não está no layout").not.toBeNull();
        expect(caixa!.height).toBeGreaterThanOrEqual(36);
      }
    });
  });
}
