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
   * O aparelho do herói é DOM, não uma captura, e é isso que permite a tela
   * animar por dentro. Se alguém trocar a réplica de volta por um `<img>`, a
   * página continua bonita e a cena "Um dia" para de poder mudar de tela.
   */
  test("a tela do herói é texto de verdade, não uma imagem", async ({
    page,
  }) => {
    await page.goto(`${APP}/`);
    await page.waitForLoadState("networkidle");

    const tela = page.locator(".tela-app").first();
    await expect(tela).toHaveCount(1);
    await expect(tela).toContainText("Sobra até o fim do mês");

    // `container-type: inline-size` é o que faz o dimensionamento em `cqw`
    // funcionar. Sem ele todo `text-[4cqw]` vira zero e a tela renderiza vazia,
    // com a moldura no lugar e nada dentro.
    const containerType = await tela.evaluate(
      (el) => getComputedStyle(el).containerType,
    );
    expect(containerType).toBe("inline-size");
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

test.describe("APP-02: movimento reduzido", () => {
  test.use({ reducedMotion: "reduce" });

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
  });
});
