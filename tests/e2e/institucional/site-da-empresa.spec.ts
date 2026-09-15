/**
 * INSTITUCIONAL-01: o site da empresa, no navegador.
 *
 * Os testes unitários provam a política de host como string, e
 * `superficies/host-routing.spec.ts` prova que as seis páginas respondem e
 * sobrevivem à hidratação. Sobra o que só um navegador vê: a transição de
 * cortina entre páginas, as âncoras internas e o caminho de movimento reduzido.
 *
 * O de movimento reduzido é o mais importante dos três. Toda cena aqui é escrita
 * no estado FINAL e animada com `fromTo` ou `useTransform`, justamente para que
 * sob `prefers-reduced-motion` nenhuma timeline seja criada e o DOM do servidor
 * fique valendo. Se alguém escrever uma cena a partir do estado inicial, a
 * página continua respondendo 200, continua passando no type check, e some pela
 * metade para quem pediu menos movimento. Nada falha, exceto isto.
 */

import { test, expect } from "@playwright/test";

/**
 * A porta do servidor de teste, sobreponível.
 *
 * O padrão é a 3001 do `webServer` do Playwright. O override existe para rodar
 * este arquivo contra um `npm run dev` já aberto: as páginas são públicas e não
 * tocam em Firebase, então elas não precisam da infraestrutura que o
 * `global-setup` levanta.
 */
const PORTA = process.env.E2E_PORT ?? 3001;
const APEX = `http://localhost:${PORTA}`;

const PAGINAS = [
  "/institucional",
  "/sobre",
  "/manifesto",
  "/produtos",
  "/fale-conosco",
];

test.describe("INSTITUCIONAL-01: navegação do site da empresa", () => {
  test("a cortina leva de uma página a outra e troca a URL", async ({
    page,
  }) => {
    await page.goto(`${APEX}/sobre`);
    await page.waitForLoadState("networkidle");

    // `getByRole("link")` e não `getByLabel`: o rótulo do menu aparece também no
    // rodapé e no índice do fecho, então um seletor por texto casaria três.
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Manifesto" })
      .click();

    // A navegação passa por uma animação antes do `router.push`, então o
    // `waitForURL` aqui não é cerimônia: sem ele o teste lê a URL antiga.
    await page.waitForURL(`${APEX}/manifesto`);
    await expect(page).toHaveTitle(/Manifesto da ProOps/);

    // A cortina tem que ter saído do caminho. Ela é `pointer-events-none`, mas
    // uma que ficasse opaca deixaria a página coberta, e o teste seguinte de
    // conteúdo passaria mesmo assim porque o elemento existe no DOM.
    await expect(
      page.getByRole("heading", { level: 1, name: /decide/i }),
    ).toBeVisible();
  });

  /**
   * A cortina tem que COBRIR, e é isso que este teste mede.
   *
   * A primeira versão não cobria e nada denunciava: `scale-y-0` do Tailwind v4
   * compila para a propriedade CSS `scale`, que COMPÕE com `transform` em vez de
   * ser sobrescrita por ele, então o painel ficava fora da tela por mais que o
   * GSAP animasse o transform. A navegação parecia instantânea, o console ficava
   * limpo, e um teste de URL ou de título passava.
   *
   * Por isso a asserção é sobre PIXEL: um amostrador em rAF grava a maior faixa
   * do viewport que o painel chegou a cobrir. É SOBREPOSIÇÃO e não altura: o
   * painel é `inset-0`, então a altura dele é a da tela mesmo quando ele está
   * inteiro fora dela, e medir altura passaria com a cortina desligada.
   * Amostrar é o que torna o teste determinístico; tirar um screenshot no meio
   * dependeria de acertar a janela da animação.
   */
  test("a cortina cobre a tela de verdade durante a transição", async ({
    page,
  }) => {
    await page.goto(`${APEX}/sobre`);
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => {
      const w = window as unknown as { __alturaMax: number };
      w.__alturaMax = 0;
      const amostra = () => {
        const painel = document.querySelector("[data-painel]");
        const palco = painel?.closest("[data-cortina]");
        if (painel && palco && getComputedStyle(palco).visibility !== "hidden") {
          const r = painel.getBoundingClientRect();
          const coberto =
            Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
          w.__alturaMax = Math.max(w.__alturaMax, coberto);
        }
        requestAnimationFrame(amostra);
      };
      requestAnimationFrame(amostra);
    });

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Manifesto" })
      .click();
    await page.waitForURL(`${APEX}/manifesto`);

    const { maior, altura } = await page.evaluate(() => ({
      maior: (window as unknown as { __alturaMax: number }).__alturaMax,
      altura: window.innerHeight,
    }));

    // Bem acima de zero e perto da tela cheia. O piso é 80% e não 100% porque a
    // amostragem pega quadros durante a subida do painel.
    expect(maior).toBeGreaterThan(altura * 0.8);
  });

  /**
   * O MESMO teste, agora de uma sub-página para a RAIZ, que é a direção em que
   * a cortina não cobria coisa nenhuma.
   *
   * Até a fusão dos layouts, `/institucional` tinha um `layout.tsx` próprio e as
   * outras quatro páginas tinham o do route group. Cruzar entre os dois
   * desmontava o `CurtainProvider` com o painel ainda em pé e montava um novo,
   * cujo guarda de primeiro render manda ele não fazer nada: o painel não subia,
   * ele simplesmente deixava de existir, e a página aparecia num corte. A URL
   * trocava, o conteúdo estava certo, e só a animação faltava, numa direção de
   * duas. O teste acima passava, porque ele vai de sub-página para sub-página.
   *
   * O amostrador mede a subida também, e não só a descida: `__depois` guarda a
   * MENOR cobertura vista depois do pico, que é o que prova que o painel saiu
   * andando em vez de sumir. Sem essa metade, um painel que desaparecesse de uma
   * vez continuaria passando.
   *
   * E mede a ORDEM: a entrada do herói tem que começar depois de o painel sair
   * da frente, nunca atrás dele. É o `animationstart` das classes de entrada
   * contra o instante em que o painel deixou de cobrir a tela.
   */
  test("a cortina cobre e depois SOBE também indo para a raiz", async ({
    page,
  }) => {
    await page.goto(`${APEX}/sobre`);
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => {
      const w = window as unknown as {
        __maior: number;
        __depois: number;
        __atributo: boolean;
        __moveuAntes: boolean;
        __cobertoNaSoltura: number | null;
      };
      w.__maior = 0;
      w.__depois = Number.POSITIVE_INFINITY;
      w.__atributo = false;
      w.__moveuAntes = false;
      w.__cobertoNaSoltura = null;

      const partida = location.pathname;
      let ultimoCoberto = 0;
      let tinhaAtributo = false;

      /**
       * `true` enquanto a primeira linha do herói ainda está no quadro inicial.
       *
       * Medir o TRANSFORM e não o `animationstart`: uma animação CSS pausada no
       * tempo zero com atraso zero já disparou `animationstart`, então o evento
       * não distingue "começou a se mexer" de "foi criada pausada". O
       * deslocamento na tela distingue.
       */
      const heroiParado = () => {
        const linha = document.querySelector("h1 .hero-rise-line");
        if (!linha) return true;
        const m = new DOMMatrixReadOnly(getComputedStyle(linha).transform);
        return Math.abs(m.f) > 1;
      };

      const amostra = () => {
        const cobrindo =
          document.documentElement.getAttribute("data-heroi") === "espera";
        if (cobrindo) w.__atributo = true;

        // Só depois da troca de rota: antes dela o `h1` na tela é o da página
        // que está SAINDO, e a entrada dele terminou há muito tempo.
        if (cobrindo && location.pathname !== partida && !heroiParado()) {
          w.__moveuAntes = true;
        }
        if (tinhaAtributo && !cobrindo && w.__cobertoNaSoltura === null) {
          w.__cobertoNaSoltura = ultimoCoberto;
        }
        tinhaAtributo = tinhaAtributo || cobrindo;

        const painel = document.querySelector("[data-painel]");
        const palco = painel?.closest("[data-cortina]");
        if (painel && palco && getComputedStyle(palco).visibility !== "hidden") {
          const r = painel.getBoundingClientRect();
          const coberto =
            Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
          ultimoCoberto = coberto;
          w.__maior = Math.max(w.__maior, coberto);
          if (w.__maior > window.innerHeight * 0.8) {
            w.__depois = Math.min(w.__depois, coberto);
          }
        }
        requestAnimationFrame(amostra);
      };
      requestAnimationFrame(amostra);
    });

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "ProOps, página inicial" })
      .click();
    await page.waitForURL(`${APEX}/institucional`);
    // Espera pela SOLTURA e não por um relógio: um `waitForTimeout` fixo vira
    // flaky na primeira máquina lenta, medindo nada e reprovando sem motivo.
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { __cobertoNaSoltura: number | null })
                .__cobertoNaSoltura !== null,
          ),
        { timeout: 15_000 },
      )
      .toBe(true);

    const medida = await page.evaluate(() => {
      const w = window as unknown as {
        __maior: number;
        __depois: number;
        __atributo: boolean;
        __moveuAntes: boolean;
        __cobertoNaSoltura: number | null;
      };
      return {
        maior: w.__maior,
        depois: w.__depois,
        atributo: w.__atributo,
        moveuAntes: w.__moveuAntes,
        cobertoNaSoltura: w.__cobertoNaSoltura ?? Number.POSITIVE_INFINITY,
        altura: window.innerHeight,
        preso: document.documentElement.getAttribute("data-heroi"),
      };
    });

    expect(medida.maior).toBeGreaterThan(medida.altura * 0.8);
    // Saiu andando: em algum quadro depois do pico o painel cobria menos de um
    // quinto da tela.
    expect(medida.depois).toBeLessThan(medida.altura * 0.2);
    // E a entrada do herói foi segurada enquanto isso, senão ela toca inteira
    // atrás do preto e o leitor chega numa página já parada.
    expect(medida.atributo).toBe(true);
    // ...e destravada depois. Preso aqui congela o herói de toda página do site.
    expect(medida.preso).toBeNull();

    // A ordem, que é o ponto: primeiro o painel sai, depois o herói entra.
    // Medido por PIXEL e não por relógio, então isto continua valendo se a
    // duração ou a ease da saída mudarem.
    expect(
      medida.moveuAntes,
      "o herói se mexeu enquanto o painel ainda cobria a tela",
    ).toBe(false);
    /*
      12% da tela, e não zero, porque a amostra é de um quadro ANTES.

      A saída acelera, então nos últimos 16ms o painel percorre umas dezenas de
      pixels: o último quadro medido antes de o atributo sumir ainda o pega com
      uma faixa na tela, e isso é amostragem, não atraso. A folga continua
      afirmando o que importa: soltando meio segundo antes do fim, como já foi
      medido, o painel ainda cobre quase 90% da tela.
    */
    expect(
      medida.cobertoNaSoltura,
      "a entrada foi destravada com o painel ainda na frente",
    ).toBeLessThan(medida.altura * 0.12);
  });

  /**
   * O wordmark tem que levar para o SITE DA EMPRESA, e hoje a raiz dele é
   * `/institucional`: o apex ainda serve o ERP. Escrito como `/` cru, este link
   * levava de `/carreiras` direto para a landing do ERP, que responde 200 e
   * troca a URL, então um teste que só olhasse o endereço passaria. Daí a
   * asserção ser sobre o TÍTULO, que é o que diz em qual dos dois sites a pessoa
   * caiu. Depois da virada os dois viram a mesma coisa e o teste segue valendo.
   */
  test("o wordmark volta para a raiz do site da empresa, não para o ERP", async ({
    page,
  }) => {
    await page.goto(`${APEX}/produtos`);
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "ProOps, página inicial" })
      .click();

    await expect(page).toHaveTitle(/software de gestão para quem vende projeto/i);
    await expect(
      page.getByRole("heading", { level: 1, name: /ProOps/ }),
    ).toBeAttached();
  });

  /**
   * A abertura toca UMA vez por carregamento de documento. Voltando para a raiz
   * por dentro do site, a cortina da transição já cobriu a troca, e reproduzir a
   * abertura por cima dela faz o mesmo efeito gaguejar duas vezes.
   */
  test("a abertura não toca de novo numa navegação interna", async ({
    page,
  }) => {
    await page.goto(`${APEX}/institucional`);
    await page.waitForLoadState("networkidle");
    expect(await page.locator(".abertura-lamina").count()).toBeGreaterThan(0);

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Sobre" })
      .click();
    await page.waitForURL(`${APEX}/sobre`);

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "ProOps, página inicial" })
      .click();
    await page.waitForURL(`${APEX}/institucional`);

    await expect(page.locator(".abertura-lamina")).toHaveCount(0);
  });

  /**
   * O fecho de cada página revela linha a linha, e TODA linha tem que começar
   * escondida.
   *
   * Com `stagger`, o render imediato de um `fromTo` do GSAP só alcança a
   * primeira unidade: as outras ficavam visíveis e no lugar até a sub-tween
   * delas começar, e nesse instante saltavam para invisível antes de subir. O
   * que se via era um PISCA, e como cada parágrafo desses fechos tem duas
   * linhas, metade delas piscava. Nada falhava: o texto estava lá, legível, e a
   * animação acontecia.
   *
   * A asserção é com a página no TOPO, longe do gatilho: o estado correto ali é
   * toda linha em `opacity: 0`. Uma linha em 1 é uma que nunca recebeu o estado
   * inicial.
   */
  test("nenhuma linha do fecho fica visível antes da revelação", async ({
    page,
  }) => {
    const FECHOS = [
      { url: "/manifesto", secao: "A contrapartida" },
      { url: "/sobre", secao: "Uma nota dos sócios" },
      { url: "/produtos", secao: "Por que a mesma empresa faz os dois" },
      { url: "/fale-conosco", secao: "Quem responde" },
    ];

    for (const fecho of FECHOS) {
      await page.goto(`${APEX}${fecho.url}`);
      await page.waitForLoadState("networkidle");

      const linhas = page.locator(
        `[aria-label="${fecho.secao}"] .split-line`,
      );
      // O split existe: sem isto, uma seção que perdesse o `SplitReveal`
      // passaria com zero linhas e zero falhas.
      await expect
        .poll(async () => linhas.count(), { timeout: 10_000 })
        .toBeGreaterThan(1);

      const opacidades = await linhas.evaluateAll((els) =>
        els.map((el) => Number(getComputedStyle(el).opacity)),
      );
      expect(
        opacidades.filter((o) => o > 0.01),
        `${fecho.url}: linha visível antes de a revelação começar`,
      ).toHaveLength(0);
    }
  });

  /**
   * A revelação toca DE NOVO quando o leitor volta.
   *
   * As cenas de revelação eram `once: true`, e numa página inteira construída
   * sobre movimento uma seção que não responde mais na segunda passada parece
   * quebrada: o leitor não tem como saber que ela "já tocou". Agora elas usam
   * `CENA_REPETE`, e o ciclo tem que fechar: escondido no topo, revelado embaixo,
   * escondido de novo na volta, revelado de novo na segunda descida.
   *
   * A roda de verdade e não `window.scrollTo`: a página roda Lenis, e é o Lenis
   * que chama `ScrollTrigger.update`. Com `scrollTo` a página anda e as cenas
   * congelam no progresso anterior, o que parece cena quebrada e é ferramenta
   * errada.
   */
  test("a revelação do fecho toca de novo na segunda descida", async ({
    page,
  }) => {
    await page.goto(`${APEX}/manifesto`);
    await page.waitForLoadState("networkidle");

    const linhas = page.locator('[aria-label="A contrapartida"] .split-line');
    const opacidades = () =>
      linhas.evaluateAll((els) =>
        els.map((el) => Number(getComputedStyle(el).opacity)),
      );

    const rolar = async (delta: number, vezes: number) => {
      for (let i = 0; i < vezes; i++) {
        await page.mouse.wheel(0, delta);
        await page.waitForTimeout(220);
      }
      await page.waitForTimeout(1800);
    };

    const todas = (valores: number[], alvo: number) =>
      valores.length > 1 && valores.every((v) => Math.abs(v - alvo) < 0.05);

    expect(todas(await opacidades(), 0)).toBe(true);
    await rolar(900, 9);
    expect(todas(await opacidades(), 1)).toBe(true);

    await page.mouse.wheel(0, -20000);
    await page.waitForTimeout(2500);
    expect(
      todas(await opacidades(), 0),
      "voltando ao topo a cena tem que voltar ao estado inicial",
    ).toBe(true);

    await rolar(900, 9);
    expect(
      todas(await opacidades(), 1),
      "na segunda descida a revelação tem que acontecer de novo",
    ).toBe(true);
  });

  /**
   * A cisalha do wordmark não pode decepar a letra.
   *
   * Cada letra da raiz mora numa caixa recortada, que existe para o corte
   * VERTICAL da subida. `overflow-hidden` corta nos quatro lados, e a caixa tem
   * exatamente a largura de avanço do glifo: com o ponteiro no extremo, a última
   * letra é empurrada 9,6px para o lado e a ponta dela era cortada reto, o que na
   * tela parece defeito da fonte. O recorte é `clip-path` com folga lateral
   * agora, e o teste mede a folga contra o deslocamento real.
   */
  test("o wordmark não é cortado quando a cisalha vai ao extremo", async ({
    page,
  }) => {
    await page.goto(`${APEX}/institucional`);
    await page.waitForLoadState("networkidle");

    const largura = page.viewportSize()?.width ?? 1280;
    await page.mouse.move(largura - 1, 400);
    await page.waitForTimeout(1200);

    const letras = await page.evaluate(() => {
      const riscos = [...document.querySelectorAll("h1 .hero-rise-line")];
      return riscos.map((risco) => {
        const caixa = (risco.parentElement as HTMLElement).getBoundingClientRect();
        const glifo = (risco.firstElementChild as HTMLElement).getBoundingClientRect();
        const clip = getComputedStyle(risco.parentElement as HTMLElement).clipPath;
        const folga = Number(/-(\d+(?:\.\d+)?)px/.exec(clip)?.[1] ?? 0);
        return {
          saliencia: Math.max(glifo.right - caixa.right, caixa.left - glifo.left),
          folga,
        };
      });
    });

    expect(letras.length).toBeGreaterThan(1);
    for (const letra of letras) {
      // A folga do recorte tem que cobrir o quanto o glifo saiu da caixa.
      expect(letra.folga).toBeGreaterThan(letra.saliencia);
    }
  });

  /**
   * A barra RECUA ao descer, e não sai da tela.
   *
   * A primeira versão saía inteira (`-translate-y-full`). Resolvia o ruído sobre
   * as cenas de tela cheia e criava outro problema: o menu deixava de estar onde
   * a pessoa o procura, e voltar a ele passava a exigir um gesto. Agora ela sobe
   * oito pixels e fica mais translúcida, o que é o oposto de sumir.
   *
   * As duas metades importam. "Recuou" sozinho passaria com a barra fora da
   * tela; "continua na tela" sozinho passaria com ela imóvel.
   */
  test("a barra recua ao descer e continua alcançável", async ({ page }) => {
    await page.goto(`${APEX}/institucional`);
    await page.waitForLoadState("networkidle");

    // Longe da faixa de cima: o ponteiro parado lá traz a barra de volta
    // inteira, de propósito, e isso faria a medida abaixo ler o estado errado.
    await page.mouse.move(700, 600);

    const topoDaBarra = () =>
      page.evaluate(
        () => document.querySelector("header")!.getBoundingClientRect().top,
      );

    expect(await topoDaBarra()).toBeCloseTo(0, 0);

    for (let i = 0; i < 8; i += 1) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(140);
    }
    await page.waitForTimeout(1200);

    const recuado = await topoDaBarra();
    expect(recuado, "a barra não recuou ao descer").toBeLessThan(-2);
    expect(recuado, "a barra saiu da tela em vez de recuar").toBeGreaterThan(-28);

    // E continua sendo um menu: o destino segue clicável de onde está.
    await expect(
      page
        .getByRole("navigation", { name: "Principal" })
        .getByRole("link", { name: "Manifesto" }),
    ).toBeVisible();

    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(1200);
    expect(await topoDaBarra(), "a barra não voltou ao subir").toBeCloseTo(0, 0);
  });

  test("toda âncora interna aponta para um id que existe, e só um", async ({
    page,
  }) => {
    for (const caminho of PAGINAS) {
      await page.goto(`${APEX}${caminho}`);
      await page.waitForLoadState("networkidle");

      const alvos = await page
        .locator('a[href^="#"]')
        .evaluateAll((links) =>
          links.map((l) => (l as HTMLAnchorElement).getAttribute("href") ?? ""),
        );

      for (const alvo of new Set(alvos)) {
        const id = alvo.slice(1);
        if (!id) continue;
        // Exatamente um: dois elementos com o mesmo id fazem o navegador rolar
        // para o primeiro, que não é necessariamente o pretendido, e isso é HTML
        // inválido que nada mais no projeto verifica.
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      }
    }
  });
});

test.describe("INSTITUCIONAL-02: movimento reduzido", () => {
  test.use({ reducedMotion: "reduce" });

  test("cada página rende no estado final, sem nada invisível", async ({
    page,
  }) => {
    for (const caminho of PAGINAS) {
      await page.goto(`${APEX}${caminho}`);
      await page.waitForLoadState("networkidle");

      // O título de cada página tem que estar VISÍVEL, e não apenas presente:
      // `toBeVisible` reprova opacidade 0 e altura 0, que é exatamente como uma
      // cena escrita a partir do estado inicial falha.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      /**
       * A cortina de abertura é o caso mais perigoso: o keyframe usa `both`,
       * então `animation: none` sozinho a deixaria em `scaleY(1)`, ou seja, uma
       * tela preta cobrindo a página para sempre. O bloco de movimento reduzido
       * do globals.css declara o estado final por isso, e este é o teste dele.
       */
      const laminas = page.locator(".abertura-lamina");
      if ((await laminas.count()) > 0) {
        const escala = await laminas.first().evaluate((el) => {
          const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          return m.d;
        });
        expect(escala).toBeLessThan(0.01);
      }

      // Nenhuma seção pode ficar apagada: uma cena escrita a partir do estado
      // inicial some inteira aqui, sem erro nenhum.
      const apagadas = await page
        .locator("section")
        .evaluateAll((secoes) =>
          secoes.filter((s) => Number(getComputedStyle(s).opacity) < 0.05)
            .length,
        );
      expect(apagadas).toBe(0);
    }
  });
});
