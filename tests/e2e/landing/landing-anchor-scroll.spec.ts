/**
 * LANDING-ANCHOR-SCROLL-01: clicar numa âncora da navbar tem que rolar a landing
 * até a seção correspondente.
 *
 * Bug: a landing roda Lenis (smooth scroll), que assume o controle do scroll do
 * documento e reaplica a própria posição a cada rAF. O `scrollToAnchor` usava
 * `window.scrollTo({ behavior: "smooth" })`, desfeito pelo Lenis no mesmo frame —
 * clicar em "Planos" trocava a URL para `#pricing` e a página não saía do lugar.
 *
 * O fix roteia os scrolls programáticos da landing pela instância viva do Lenis.
 * O branch de fallback (sem Lenis) é coberto no unit test de `scrollToOffset`.
 *
 * A asserção aqui mede o sintoma exato da regressão — a página não andava — e
 * depois confirma que a âncora ficou visível. Deliberadamente NÃO exige uma
 * posição de parada exata: a landing tem seções pinadas pelo GSAP e vídeos que
 * ainda mudam de altura enquanto o scroll acontece, então o ponto final varia
 * alguns px entre execuções. Sem o fix o alvo ficava a milhares de px do topo,
 * então a folga larga continua pegando a regressão com sobra.
 */

import { test, expect } from "../fixtures/auth.fixture";
import type { Page } from "@playwright/test";

const NAV_ANCHORS = [
  { label: "Planos", id: "pricing" },
  { label: "Recursos", id: "recursos" },
  { label: "Módulos", id: "modulos" },
  { label: "Plataforma", id: "showcase" },
] as const;

/** Deslocamento mínimo que prova que o clique realmente moveu a página. */
const MIN_SCROLL_DELTA = 500;

/**
 * A landing tem seções pinadas pelo GSAP (hero, feature-scroll, nichos) e o
 * ScrollTrigger só cria os pin-spacers depois do primeiro paint — até lá o
 * documento é milhares de px mais curto (aqui: ~17.3k px com spacers).
 * Como `scrollToAnchor` calcula o destino na hora do clique, clicar antes disso
 * mira uma posição da página curta e a rolagem para muito antes da seção.
 * Espera a altura do documento ficar estável antes de interagir.
 */
async function waitForStableLayout(page: Page) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __h?: number; __stable?: number };
      const height = document.documentElement.scrollHeight;
      if (w.__h === height) {
        w.__stable = (w.__stable ?? 0) + 1;
      } else {
        w.__h = height;
        w.__stable = 0;
      }
      return (w.__stable ?? 0) >= 5;
    },
    undefined,
    { timeout: 30000, polling: 200 },
  );
}

async function gotoLanding(page: Page) {
  await page.goto("/");
  await page.locator("#pricing").waitFor({ state: "attached", timeout: 20000 });
  // O Lenis sobe depois do primeiro paint (requestIdleCallback) e carimba
  // `lenis` no <html>. Esperar por ele garante que a condição da regressão está
  // presente — é justamente com o Lenis ativo que o scroll nativo era desfeito.
  await page.waitForFunction(
    () => document.documentElement.classList.contains("lenis"),
    undefined,
    { timeout: 20000 },
  );
  await waitForStableLayout(page);
}

/**
 * A pill da navbar só aparece (e só fica clicável) depois que a página passa do
 * hero, então todo clique em âncora precisa de um scroll real antes.
 * Usa `mouse.wheel` porque o Lenis consome eventos de wheel — um
 * `window.scrollTo` programático aqui esbarraria no próprio bug sob teste.
 */
async function revealNavbar(page: Page) {
  await page.mouse.wheel(0, 900);
  await page.waitForFunction(() => window.scrollY > 200, undefined, {
    timeout: 10000,
  });
}

async function expectScrolledToAnchor(
  page: Page,
  id: string,
  scrollBefore: number,
) {
  // 1) O sintoma exato da regressão: window.scrollY não mudava nada.
  await page.waitForFunction(
    ({ before, minDelta }) => Math.abs(window.scrollY - before) > minDelta,
    { before: scrollBefore, minDelta: MIN_SCROLL_DELTA },
    { timeout: 15000 },
  );

  // 2) E a âncora terminou visível na janela.
  await expect
    .poll(
      () =>
        page.evaluate((anchorId) => {
          const target = document.querySelector(`#${anchorId}`);
          if (!target) return Number.MAX_SAFE_INTEGER;
          const { top } = target.getBoundingClientRect();
          // Âncoras de scroll são spans de altura 0 — só o topo importa.
          return top >= -200 && top <= window.innerHeight ? 0 : Math.round(top);
        }, id),
      { timeout: 15000 },
    )
    .toBe(0);
}

test.describe("LANDING-ANCHOR-SCROLL-01: âncoras da navbar rolam a página", () => {
  test("clicar em 'Planos' rola até a seção de planos (cenário reportado)", async ({
    page,
  }) => {
    await gotoLanding(page);
    await revealNavbar(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.getByRole("link", { name: "Planos", exact: true }).first().click();

    await expectScrolledToAnchor(page, "pricing", scrollBefore);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(
      scrollBefore,
    );
  });

  for (const { label, id } of NAV_ANCHORS) {
    test(`clicar em '${label}' rola até #${id}`, async ({ page }) => {
      await gotoLanding(page);
      await revealNavbar(page);
      const scrollBefore = await page.evaluate(() => window.scrollY);

      await page.getByRole("link", { name: label, exact: true }).first().click();

      await expectScrolledToAnchor(page, id, scrollBefore);
    });
  }
});
