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
   * ser sobrescrita por ele, então as lâminas ficavam achatadas por mais que o
   * GSAP animasse o transform. A navegação parecia instantânea, o console ficava
   * limpo, e um teste de URL ou de título passava.
   *
   * Por isso a asserção é sobre PIXEL: um amostrador em rAF grava a maior altura
   * que uma lâmina alcançou durante a transição. Amostrar é o que torna o teste
   * determinístico; tirar um screenshot no meio dependeria de acertar a janela
   * de 500ms.
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
        const lamina = document.querySelector("[data-lamina]");
        if (lamina) {
          w.__alturaMax = Math.max(
            w.__alturaMax,
            lamina.getBoundingClientRect().height,
          );
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
    // amostragem pega quadros durante a subida das lâminas.
    expect(maior).toBeGreaterThan(altura * 0.8);
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
