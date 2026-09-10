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
  "/carreiras",
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

  test("o link do menu volta para a raiz da experiência", async ({ page }) => {
    await page.goto(`${APEX}/carreiras`);
    await page.waitForLoadState("networkidle");

    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "ProOps, página inicial" })
      .click();

    await page.waitForURL(`${APEX}/`);
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
