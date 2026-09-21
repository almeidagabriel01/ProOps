/**
 * APP-01: a landing do aplicativo, no navegador.
 *
 * Os testes unitários cobrem o dado estruturado e a política de host como
 * string, e `mobile/superficies-layout.spec.ts` cobre o vazamento horizontal a
 * 393px. Sobra o que só um navegador vê, e são três coisas que falham em
 * silêncio:
 *
 * 1. **Uma cena que some.** A página tem onze, e oito delas chegam por
 *    `dynamic()`. Um import quebrado ou um componente que lança durante a
 *    hidratação não derruba a página: ele apaga UMA seção, e o resto continua
 *    rolando como se nada tivesse acontecido.
 * 2. **O pisca do `SplitReveal`.** Com `stagger`, o render imediato do `fromTo`
 *    alcança só a primeira linha; sem o `gsap.set` prévio em todas elas, as
 *    outras ficam visíveis até a sub-tween começar e então saltam para
 *    invisível. O texto está lá, legível, e a animação acontece: o defeito é um
 *    pisca que nenhum type check pega.
 * 3. **O caminho de movimento reduzido.** Toda cena aqui é escrita no estado
 *    FINAL e animada com `fromTo` ou `useTransform`, para que sob
 *    `prefers-reduced-motion` nenhuma timeline seja criada e o DOM do servidor
 *    fique valendo. Uma cena escrita a partir do estado inicial continua
 *    respondendo 200, continua passando no type check, e some pela metade para
 *    quem pediu menos movimento.
 */

import { test, expect } from "@playwright/test";

/**
 * A porta do servidor de teste, sobreponível.
 *
 * O padrão é a 3001 do `webServer` do Playwright. O override existe para rodar
 * este arquivo contra um `npm run dev` já aberto: a página é pública e não toca
 * em Firebase, então ela não precisa da infraestrutura que o `global-setup`
 * levanta, e exigi-la torna a verificação local cara o bastante para ninguém
 * fazer.
 */
const PORTA = process.env.E2E_PORT ?? 3001;

/**
 * O host, e não o caminho.
 *
 * `app.localhost` é o endereço PÚBLICO desta superfície; `/aplicativo` é o alvo
 * interno do rewrite e é `noindex` para sempre. Testar pelo host é testar o que
 * o visitante recebe, incluindo a reescrita da raiz no proxy.
 */
const APP = `http://app.localhost:${PORTA}`;

/** As seções com id, na ordem em que a página as monta. */
const CENAS_COM_ID = [
  "diferenca",
  "comandos",
  "conversa",
  "privacidade",
  "quem-faz",
  "planos",
  "faq",
];

test.describe("APP-01: as cenas da landing do aplicativo", () => {
  test("as onze cenas chegam, e nenhuma some na hidratação", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    for (const id of CENAS_COM_ID) {
      await expect(
        page.locator(`#${id}`),
        `a cena #${id} não chegou: confira o dynamic() em page.tsx`,
      ).toHaveCount(1);
    }

    // Onze `<section>`: as sete acima mais o herói, o dia, a galeria e o fecho,
    // que não têm id. A barra é um `<header>` e o rodapé um `<footer>`, então
    // nenhum dos dois entra na conta. Contar em vez de só nomear é o que pega
    // uma cena REMOVIDA por engano, que um teste por id nunca veria.
    await expect(page.locator("section")).toHaveCount(11);

    // O título é o elemento de LCP e pinta por CSS, sem JavaScript nenhum.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  /**
   * O herói mostra a CAPTURA do aplicativo. Ele já foi a réplica em DOM, e a
   * comparação direta com o produto, logo acima da dobra, deixava visível cada
   * diferença de fonte e de espaçamento. As réplicas continuam nas cenas de
   * baixo, e é delas que o `@container` é cobrado.
   */
  test("o herói mostra a captura, e as réplicas medem pelo aparelho", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    const heroi = page.locator("section").first();
    await expect(heroi.locator('img[src*="hoje.jpg"]')).toHaveCount(1);
    await expect(heroi.locator(".tela-app")).toHaveCount(0);

    const tela = page.locator(".tela-app").first();
    await expect(tela).toHaveCount(1);

    // `container-type: inline-size` é o que faz o dimensionamento em `cqw`
    // funcionar. Sem ele todo `cqw` cai para a viewport e a tela estoura a
    // moldura, que foi exatamente o que chegou a um deploy.
    const containerType = await tela.evaluate(
      (el) => getComputedStyle(el).containerType,
    );
    expect(containerType).toBe("inline-size");
  });

  /**
   * A prateleira mostra só capturas. A aba Agente já foi uma réplica em DOM, e a
   * tab bar redesenhada à mão saía diferente da do aplicativo ao lado de cinco
   * capturas verdadeiras. Vale nas duas plataformas, porque o nome do arquivo
   * dessa aba muda entre elas.
   */
  test("a prateleira de telas usa só as capturas originais", async ({
    page,
  }) => {
    // Sem o Lenis, pelo mesmo motivo do teste do FAQ: o clique no seletor de
    // plataforma precisa cair onde o botão está.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    const itens = page.locator(".tela-item");
    await expect(itens).toHaveCount(6);
    await expect(itens.locator(".tela-app")).toHaveCount(0);

    for (const [plataforma, arquivo] of [
      ["iOS", "/mockup-ios/agenda.jpg"],
      ["Android", "/mockup-android/agente.jpg"],
    ] as const) {
      await page.getByRole("radio", { name: plataforma }).click();
      const agente = itens.nth(4).locator("img");
      await expect(agente).toHaveAttribute(
        "src",
        new RegExp(encodeURIComponent(arquivo)),
      );
      await expect(itens.locator("img")).toHaveCount(6);
    }
  });

  /**
   * O ponto da linha do tempo de "Um dia qualquer" corre por cima dos momentos.
   * Os momentos vêm depois no DOM e são `absolute`, então sem `z-index` no
   * trilho o aparelho pintava por cima do ponto. O teste leva o ponto até a
   * altura do aparelho e pergunta ao navegador o que está no topo ali.
   */
  test("o ponto da linha do tempo fica por cima do aparelho", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    const ponto = page.locator(".rail-ponto");
    await ponto.scrollIntoViewIfNeeded();
    const aparelho = page.locator(".momento-0 .tela-app");
    await expect(aparelho).toHaveCount(1);

    const resultado = await page.evaluate(() => {
      const dot = document.querySelector<HTMLElement>(".rail-ponto")!;
      const trilho = dot.parentElement!;
      const tela = document.querySelector(".momento-0 .tela-app")!;
      const caixaTela = tela.getBoundingClientRect();
      const caixaTrilho = trilho.getBoundingClientRect();
      // Põe o ponto na altura do meio do aparelho, onde o defeito aparecia.
      dot.style.top = `${caixaTela.top + caixaTela.height / 2 - caixaTrilho.top}px`;
      // O trilho é `pointer-events-none`, e `elementFromPoint` pula quem não
      // recebe ponteiro. Ligado só no ponto, a pergunta volta a ser de camada.
      dot.style.pointerEvents = "auto";
      const caixa = dot.getBoundingClientRect();
      const topo = document.elementFromPoint(
        caixa.left + caixa.width / 2,
        caixa.top + caixa.height / 2,
      );
      return {
        pontoNoTopo: topo === dot,
        // Medido pela MOLDURA, não pela tela: o bezel sozinho já dá uns 10px.
        folga:
          caixaTrilho.left -
          tela.closest(".self-center")!.getBoundingClientRect().right,
      };
    });

    expect(resultado.pontoNoTopo).toBe(true);
    // E a moldura não encosta na linha, onde o anel do ponto a sobreporia.
    expect(resultado.folga).toBeGreaterThan(16);
  });

  /**
   * Hidratação: a página inteira é renderizada no servidor e "acordada" no
   * cliente. Um desencontro entre os dois não quebra nada visível, mas deixa a
   * subárvore sem os atributos que o servidor mandou.
   *
   * Já aconteceu por um motivo que ninguém procuraria: `Math.cos` devolvia a
   * 15ª casa decimal diferente no Node e no Chrome, e cada marca do mostrador
   * da cota virava um aviso.
   */
  test("a página hidrata sem desencontro entre servidor e cliente", async ({
    page,
  }) => {
    const erros: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /hydrat/i.test(m.text()))
        erros.push(m.text());
    });
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");
    // A seção de comandos só hidrata quando o chunk dela chega.
    await page.locator("#comandos").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    expect(erros, erros.join(" / ")).toHaveLength(0);
  });

  /**
   * O campo que segue o ponteiro é CSS lendo duas variáveis herdadas. Ele já
   * sumiu inteiro uma vez sem erro nenhum: um `color-mix()` escrito direto
   * dentro do `radial-gradient` faz o Lightning CSS descartar a regra no build,
   * selector incluído, e o elemento fica transparente.
   */
  test("o campo do herói tem gradiente, e não foi descartado no build", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    const campo = page.locator(".campo-app");
    await expect(campo).toHaveCount(1);

    const fundo = await campo.evaluate(
      (el) => getComputedStyle(el).backgroundImage,
    );
    expect(fundo).toContain("radial-gradient");
  });

  /**
   * A asserção é com a página no TOPO, longe do gatilho: o estado correto ali é
   * toda linha em `opacity: 0`. Uma linha em 1 é uma que nunca recebeu o estado
   * inicial, e é exatamente o pisca descrito no cabeçalho deste arquivo.
   */
  test("nenhuma linha do fecho fica visível antes da revelação", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    const linhas = page.locator(
      '[aria-label="O que a ProOps Pessoal resolve"] .split-line',
    );

    // O split existe: sem isto, um fecho que perdesse o `SplitReveal` passaria
    // com zero linhas e zero falhas.
    await expect
      .poll(async () => linhas.count(), { timeout: 10_000 })
      .toBeGreaterThan(1);

    const opacidades = await linhas.evaluateAll((els) =>
      els.map((el) => Number(getComputedStyle(el).opacity)),
    );
    expect(
      opacidades.filter((o) => o > 0.01),
      "linha do fecho visível antes de a revelação começar",
    ).toHaveLength(0);
  });

  /**
   * O FAQ é acordeão nativo. Ele tem que abrir ANTES de qualquer JavaScript,
   * porque não há JavaScript nenhum por trás dele: se alguém trocar `<details>`
   * por um estado de React, isto continua passando na tela e para de funcionar
   * com o bundle bloqueado.
   */
  test("o FAQ abre pelo navegador, sem JavaScript", async ({ page }) => {
    // Movimento reduzido aqui não é sobre acessibilidade, é sobre poder clicar:
    // sob `reduce` o `SmoothScroll` nunca cria o Lenis, e a rolagem volta a ser
    // a nativa. Com o Lenis no ar, o `scrollIntoView` do Playwright e o rAF dele
    // disputam a posição, e o clique cai onde o elemento ESTAVA. O teste é sobre
    // o `<details>`, não sobre rolagem inercial.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${APP}/`);
    const primeira = page.locator("#faq details").first();

    await expect(primeira).not.toHaveAttribute("open", "");
    await primeira.locator("summary").click();
    await expect(primeira).toHaveAttribute("open", "");
  });
});

/**
 * A seção de comandos: a roda de pedidos, a leitura da frase e a mesa de
 * operações. As três são JavaScript de ponta a ponta, e as três falham caladas:
 * uma roda que não troca a leitura, uma aba que não troca a cena e um campo da
 * ficha que nunca recebe o seu token continuam renderizando sem erro nenhum.
 */
test.describe("APP-03: o que você pode pedir", () => {
  const leitura = (page: import("@playwright/test").Page) =>
    page.locator("#comandos p .sr-only").first();

  test("a roda troca a leitura, por toque e por teclado", async ({ page }) => {
    // Sem o Lenis, para o clique cair onde a linha está (ver o teste do FAQ).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    const roda = page.getByRole("listbox", { name: "Pedidos de exemplo" });
    await expect(roda.getByRole("option")).toHaveCount(7);
    await expect(leitura(page)).toHaveText("gastei 45 no mercado");

    await roda.scrollIntoViewIfNeeded();
    await roda
      .getByRole("option", { name: "me lembra de pagar o aluguel todo dia 5" })
      .click();
    await expect(leitura(page)).toHaveText(
      "me lembra de pagar o aluguel todo dia 5",
    );
    const ficha = page.locator("#comandos .ficha").first();
    await expect(ficha).toContainText("Lembrete");
    await expect(ficha).toContainText("Todo mês, dia 5");

    await roda.focus();
    await page.keyboard.press("ArrowDown");
    await expect(roda.getByRole("option", { selected: true })).toHaveText(
      "parcela a geladeira de 3.200 em 10x",
    );
    await expect(leitura(page)).toHaveText(
      "parcela a geladeira de 3.200 em 10x",
    );
    await expect(ficha).toContainText("10x de R$ 320,00");

    // A roda é circular: antes da primeira vem a última.
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    await expect(leitura(page)).toHaveText("desfaz o último");
  });

  test("as abas da mesa trocam a cena, com setas e foco", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    const abas = page.getByRole("tablist", { name: "Operações de exemplo" });
    await expect(abas.getByRole("tab")).toHaveCount(6);
    const painel = page.getByRole("tabpanel");

    await abas.getByRole("tab", { name: "desfaz o último" }).click();
    await expect(
      abas.getByRole("tab", { name: "desfaz o último" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(painel).toContainText("desfeito");

    await page.keyboard.press("ArrowUp");
    const meta = abas.getByRole("tab", {
      name: "guarda 200 na meta da viagem",
    });
    await expect(meta).toBeFocused();
    await expect(meta).toHaveAttribute("aria-selected", "true");
    await expect(painel).toContainText("R$ 2.300,00");

    await page.keyboard.press("Home");
    await expect(painel).toContainText("em 10x");
  });

  /**
   * Com movimento: a seção é dirigida pela rolagem. Os testes rolam pela roda
   * do mouse, que é o caminho real (o Lenis desfaz um `window.scrollTo`), e
   * esperam a posição assentar antes de afirmar.
   */
  test("rolar escreve a frase e monta a ficha, e subir a devolve", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");
    const roda = page.getByRole("listbox", { name: "Pedidos de exemplo" });

    await rolarAteFatia(page, roda, 3, 7);
    await expect(leitura(page)).toHaveText(
      "parcela a geladeira de 3.200 em 10x",
    );
    await expect(roda.getByRole("option", { selected: true })).toHaveText(
      "parcela a geladeira de 3.200 em 10x",
    );
    // Os campos que vieram da frase nascem invisíveis e só aparecem quando o
    // token pousa neles; um seletor de entidade errado os deixa apagados.
    const valores = page
      .locator("#comandos .ficha")
      .first()
      .locator(".ficha-valor");
    await expect
      .poll(
        () =>
          valores.evaluateAll((els) =>
            els.every((el) => Number(getComputedStyle(el).opacity) > 0.99),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
    await expect(page.locator(".leitura-fantasma:visible")).toHaveCount(0);

    await rolarAteFatia(page, roda, 1, 7);
    await expect(leitura(page)).toHaveText("quanto sobra esse mês?");
  });

  test("tocar numa frase da roda leva a página até ela", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");
    const roda = page.getByRole("listbox", { name: "Pedidos de exemplo" });
    await rolarAteFatia(page, roda, 0, 7);
    await expect(leitura(page)).toHaveText("gastei 45 no mercado");

    const antes = await page.evaluate(() => window.scrollY);
    await roda
      .getByRole("option", { name: "transfere 500 da conta pro cartão" })
      .click();
    await expect(leitura(page)).toHaveText(
      "transfere 500 da conta pro cartão",
      {
        timeout: 10_000,
      },
    );
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(antes);
  });

  /**
   * A mesa de operações NÃO prende a rolagem: ela responde ao clique. Duas
   * seções seguidas dirigidas por scroll era uma a mais, e o teste de que ela
   * não voltou a ser um trilho é a ausência do contêiner alto.
   */
  test("a mesa troca a cena no clique, sem prender a rolagem", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");
    const abas = page.getByRole("tablist", { name: "Operações de exemplo" });
    await abas.scrollIntoViewIfNeeded();

    // A mesa vive fora de qualquer trilho: nenhum ancestral dela é alto.
    expect(
      await abas.evaluate((el) => el.closest("div[style*='svh']") === null),
    ).toBe(true);

    const meta = abas.getByRole("tab", {
      name: "guarda 200 na meta da viagem",
    });
    await meta.click();
    await expect(meta).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("R$ 2.300,00", {
      timeout: 10_000,
    });

    // E a cena toca de novo sem sair da operação.
    await page.getByRole("button", { name: "Repetir" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("R$ 2.300,00", {
      timeout: 10_000,
    });
  });
});

/**
 * Leva a página até o meio da fatia `indice` do trilho que contém `ancora`,
 * pela roda do mouse. O Lenis tem inércia, então o movimento é corrigido em
 * alguns passos até assentar perto do alvo.
 */
async function rolarAteFatia(
  page: import("@playwright/test").Page,
  ancora: import("@playwright/test").Locator,
  indice: number,
  total: number,
) {
  const alvo = await ancora.evaluate(
    (el, [i, n]) => {
      const trilho = el.closest<HTMLElement>("div[style*='svh']")!;
      // O palco gruda a 96px do topo (sob a barra fixa), e é daí que o
      // trilho começa a contar.
      const inicio = trilho.getBoundingClientRect().top + window.scrollY - 96;
      const alcance = trilho.offsetHeight - (window.innerHeight - 96);
      return inicio + ((i + 0.82) / n) * alcance;
    },
    [indice, total] as const,
  );
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    const falta = alvo - (await page.evaluate(() => window.scrollY));
    if (Math.abs(falta) < 40) break;
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, falta);
    await page.waitForTimeout(900);
  }
}

test.describe("APP-02: movimento reduzido", () => {
  // `reducedMotion` fica em `contextOptions`. Escrito direto no `use` ele é
  // ignorado sem erro: este teste passou meses rodando COM movimento, e só
  // pegou isso quando ganhou uma asserção que muda entre os dois modos.
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("a página rende no estado final, sem nada invisível", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Nenhuma seção pode ficar apagada: uma cena escrita a partir do estado
    // inicial some inteira aqui, sem erro nenhum.
    const apagadas = await page
      .locator("section")
      .evaluateAll(
        (secoes) =>
          secoes.filter((s) => Number(getComputedStyle(s).opacity) < 0.05)
            .length,
      );
    expect(apagadas).toBe(0);

    /**
     * O fecho é o caso mais perigoso desta página: sob movimento reduzido o
     * `SplitReveal` não cria timeline nenhuma, então as linhas têm que já estar
     * VISÍVEIS. Se elas ficarem em `opacity: 0` aqui, o fecho inteiro some para
     * quem pediu menos movimento, e a seção continua no DOM com a altura certa.
     */
    const fecho = page.locator(
      '[aria-label="O que a ProOps Pessoal resolve"] h2',
    );
    await expect(fecho).toBeVisible();

    // A conversa dirigida por scroll idem: sem `progresso`, as seis mensagens
    // são escritas no estado final.
    await expect(
      page.locator("#conversa").getByText("Confirma que dou baixa", {
        exact: false,
      }),
    ).toBeVisible();

    // A seção de comandos não gruda nem rola: sem trilho, a ficha já inteira.
    await expect(page.locator("#comandos div[style*='svh']")).toHaveCount(0);
    const valores = page.locator("#comandos .ficha-valor");
    await expect(valores.first()).toBeVisible();
    const apagados = await valores.evaluateAll(
      (els) =>
        els.filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length,
    );
    expect(apagados).toBe(0);
  });
});
