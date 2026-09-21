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
 * 4. **A roda engolia a rolagem.** Com `touch-action: none`, todo toque que
 *    começasse em cima dela (metade do palco, num celular) deixava de rolar a
 *    página e passava a dirigi-la por saltos: um deslize de 96px movia 2707px.
 *    É o que se via como tremor.
 * 5. **Número cortado dentro do cartão.** Os três desfechos da simulação em
 *    três colunas davam 63px a um valor que pede 88, e o NumberFlow recorta os
 *    dígitos na própria caixa: nada transborda, o número só aparece pela
 *    metade.
 * 6. **A prateleira parecia ter duas telas.** `snap-mandatory` sem
 *    `scroll-padding` encostava a primeira moldura na borda, e com molduras de
 *    52% cabiam duas e nada mais.
 * 7. **"Um dia qualquer" media 4.289px.** Os seis momentos empilhados eram
 *    quase seis telas de rolagem para uma seção só.
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

    test("um deslize em cima da roda rola a página, e nada mais", async ({
      page,
    }) => {
      await page.goto(`${APP}/`);
      await page.waitForLoadState("networkidle");

      const roda = page.getByRole("listbox", { name: "Pedidos de exemplo" });
      await roda.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);

      // `touch-action` é a metade declarativa da correção: sem ela o navegador
      // devolve o gesto à roda mesmo que o JavaScript não o use.
      expect(await roda.evaluate((el) => getComputedStyle(el).touchAction)).toBe(
        "pan-y",
      );

      const caixa = (await roda.boundingBox())!;
      const x = caixa.x + caixa.width / 2;
      const y = caixa.y + caixa.height / 2;
      const antes = await page.evaluate(() => window.scrollY);

      // `page.touchscreen` só sabe tocar, então o deslize vai por CDP. É
      // Chromium, que é o único navegador desta suíte.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y: y + 60 }],
      });
      const PASSO = 8;
      const PASSOS = 12;
      for (let i = 1; i <= PASSOS; i += 1) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y + 60 - i * PASSO }],
        });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForTimeout(400);

      const andou = (await page.evaluate(() => window.scrollY)) - antes;
      const dedo = PASSO * PASSOS;

      // A régua é a DESPROPORÇÃO, não a precisão: a rolagem inercial acrescenta
      // um resto, e é por isso que o teto é generoso. Sem a correção, a roda
      // capturava o gesto e dirigia a página por saltos de ~175px por evento:
      // o mesmo deslize de 96px movia 2707, vinte e oito vezes o dedo.
      expect(andou, "o dedo não rolou a página").toBeGreaterThan(dedo * 0.4);
      expect(andou, "a roda sequestrou a rolagem").toBeLessThan(dedo * 3);
    });

    test("os três desfechos da simulação cabem no cartão", async ({ page }) => {
      await page.goto(`${APP}/`);
      await page.waitForLoadState("networkidle");

      const abas = page.getByRole("tablist", { name: "Operações de exemplo" });
      await abas.scrollIntoViewIfNeeded();
      await abas.getByRole("tab", { name: /posso comprar/ }).click();
      // A cena escreve os valores no fim da própria linha do tempo.
      await page.waitForTimeout(6000);

      // A régua é a largura NATURAL do número contra a caixa que ele tem, e
      // não `scrollWidth`: o NumberFlow desenha os dígitos numa caixa própria
      // com recorte, então um valor que não cabe é CORTADO em silêncio, sem
      // gerar transbordo nenhum para medir. Era exatamente esse o sintoma.
      const medidas = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".sim-cenario")].map((c) => {
          const moeda = c.querySelector<HTMLElement>("[class*='jetbrains']")!;
          const texto = c.querySelector<HTMLElement>(".sr-only")!.textContent!;
          const regua = document.createElement("span");
          const estilo = getComputedStyle(moeda);
          regua.style.cssText = `position:fixed;visibility:hidden;white-space:pre;font:${estilo.font};letter-spacing:${estilo.letterSpacing};font-variant-numeric:${estilo.fontVariantNumeric}`;
          regua.textContent = texto;
          document.body.appendChild(regua);
          const natural = regua.getBoundingClientRect().width;
          regua.remove();
          return {
            texto,
            natural: Math.round(natural),
            cabe: Math.round(moeda.clientWidth),
          };
        }),
      );

      expect(medidas).toHaveLength(3);
      for (const medida of medidas) {
        expect(
          medida.natural,
          `"${medida.texto}" pede ${medida.natural}px e tem ${medida.cabe}px`,
        ).toBeLessThanOrEqual(medida.cabe);
      }
      // O pior deles é o negativo: doze caracteres, que em três colunas num
      // aparelho de 360 tinham 63px para caber em ~88.
      expect(
        medidas.some((m) => m.texto.replace(/\s+/g, " ") === "-R$ 1.715,10"),
      ).toBe(true);
    });

    test("a prateleira de telas se anuncia como fileira", async ({ page }) => {
      await page.goto(`${APP}/`);
      await page.waitForLoadState("networkidle");

      const trilho = page.locator("ul.landing-scrollbar").first();
      await trilho.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);

      const medida = await trilho.evaluate((el) => {
        const caixa = el.getBoundingClientRect();
        const filhos = [...el.children].map((f) =>
          Math.round(f.getBoundingClientRect().left - caixa.left),
        );
        return {
          rolavel: el.scrollWidth - el.clientWidth,
          deslocada: el.scrollLeft,
          primeira: filhos[0],
          terceira: filhos[2],
          janela: window.innerWidth,
        };
      });

      expect(medida.rolavel, "a fileira não rola").toBeGreaterThan(200);
      // Com `snap-mandatory` e sem `scroll-padding` o navegador encosta a
      // primeira moldura na borda, e a fileira nasce rolada.
      expect(medida.deslocada, "a fileira nasce rolada").toBe(0);
      expect(medida.primeira, "a primeira moldura ignora a margem").toBe(24);
      // A terceira precisa ESPIAR: é ela que diz que existe mais coisa. Sem
      // isso cabiam duas inteiras e a seção lia como "o aplicativo tem duas
      // telas", que foi o relato.
      expect(medida.terceira).toBeLessThan(medida.janela - 16);

      await expect(
        page.getByText(/telas\. Arraste para o lado\./),
      ).toBeVisible();
    });

    test("um dia qualquer cabe em duas telas, e as horas trocam o momento", async ({
      page,
    }) => {
      await page.goto(`${APP}/`);
      await page.waitForLoadState("networkidle");

      const horas = page.getByRole("tablist", { name: "As horas do dia" });
      await horas.scrollIntoViewIfNeeded();
      const secao = page.locator("section:has([aria-label='As horas do dia'])");

      // Empilhados, os seis momentos davam 4.289px num aparelho de 740: seis
      // telas de rolagem para uma seção. O teto é generoso de propósito, para
      // medir a ABORDAGEM e não o conteúdo.
      const altura = await secao.evaluate((el) => el.getBoundingClientRect().height);
      expect(altura).toBeLessThan(page.viewportSize()!.height * 2);

      await expect(horas.getByRole("tab")).toHaveCount(6);
      await expect(secao.getByText("O que vence hoje chega")).toBeVisible();

      await horas.getByRole("tab").nth(3).click();
      await page.waitForTimeout(600);
      await expect(secao.getByText("O que vence hoje chega")).toBeHidden();
      await expect(secao.getByRole("tabpanel")).toBeVisible();

      // Só um momento por vez: empilhados de novo, a seção volta ao problema.
      const visiveis = await secao.evaluate(
        (el) =>
          [...el.querySelectorAll("article")].filter(
            (a) => a.getBoundingClientRect().height > 0,
          ).length,
      );
      expect(visiveis).toBe(1);
    });
  });
}
