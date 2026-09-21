/**
 * MOBILE-SUPERFICIES-01: the marketing surfaces must fit a phone.
 *
 * `mobile/no-overflow.spec.ts` covers the authenticated routes and asserts on
 * `<main>`, because the app shell has `overflow-hidden` on its outer container
 * and clips wide content instead of scrolling. These two pages have no shell:
 * they are full-bleed marketing pages, so the assertion is on the DOCUMENT, and
 * horizontal overflow here is visible as a page that slides sideways.
 *
 * They are the pages most likely to leak, and not by accident: they are built
 * out of pinned scroll scenes, a horizontally scrolling gallery, lead-in padding
 * computed from the viewport (`50vw - 7.5rem`) and, on the company site, scenes
 * whose elements START off-screen in `vw` and are only kept in by the stage's
 * `overflow-hidden`. Every one of those is a width computed in a unit that a
 * 393px phone resolves differently.
 *
 * The five company pages are here for the same reason as the root: they share a
 * shell and a scene kit, so a leak introduced in the kit shows up on whichever
 * page happens to use that piece, not on the one that was edited.
 *
 * Runs in the `mobile-chrome` project (Pixel 5, 393x851, hasTouch).
 */

import { test, expect } from "@playwright/test";

/**
 * A porta do servidor de teste, sobreponível.
 *
 * O padrão é a 3001 do `webServer` do Playwright. O override existe para rodar
 * estes dois arquivos contra um `npm run dev` já aberto: as duas páginas são
 * públicas e não tocam em Firebase, então elas não precisam da infraestrutura
 * que o `global-setup` levanta, e exigi-la torna a verificação local cara o
 * bastante para ninguém fazer.
 */
const PORTA = process.env.E2E_PORT ?? 3001;

const PAGINAS = [
  { nome: "aplicativo", url: `http://app.localhost:${PORTA}/` },
  { nome: "institucional", url: `http://localhost:${PORTA}/institucional` },
  { nome: "sobre", url: `http://localhost:${PORTA}/sobre` },
  { nome: "manifesto", url: `http://localhost:${PORTA}/manifesto` },
  { nome: "produtos", url: `http://localhost:${PORTA}/produtos` },
  { nome: "fale-conosco", url: `http://localhost:${PORTA}/fale-conosco` },
];

for (const pagina of PAGINAS) {
  test.describe(`MOBILE-SUPERFICIES-01: ${pagina.nome}`, () => {
    test("does not overflow horizontally", async ({ page }) => {
      await page.goto(pagina.url);
      await page.waitForLoadState("networkidle");

      const medida = await page.evaluate(() => ({
        documento: document.documentElement.scrollWidth,
        janela: window.innerWidth,
      }));

      // 1px of slack: sub-pixel rounding on a transformed element can report a
      // scrollWidth one larger than innerWidth without anything being visible.
      expect(medida.documento).toBeLessThanOrEqual(medida.janela + 1);
    });

    test("still fits after scrolling through the pinned scenes", async ({
      page,
    }) => {
      // The gallery and the timeline only lay out once their ScrollTriggers
      // resolve, so measuring at the top misses exactly the sections most
      // likely to leak.
      await page.goto(pagina.url);
      await page.waitForLoadState("networkidle");

      for (const fracao of [0.25, 0.5, 0.75, 1]) {
        await page.mouse.wheel(0, page.viewportSize()!.height * 4 * fracao);
        await page.waitForTimeout(250);

        const largura = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        const janela = await page.evaluate(() => window.innerWidth);
        expect(largura).toBeLessThanOrEqual(janela + 1);
      }
    });
  });
}
