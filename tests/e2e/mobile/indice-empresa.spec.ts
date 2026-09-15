/**
 * MOBILE-INDICE-01: o menu do site da empresa, no celular.
 *
 * Ele é um índice de tela cheia, e "de tela cheia" é a parte que precisa de
 * teste. O painel é `fixed inset-0`, o que normalmente resolve contra o
 * viewport; mas o `<header>` carrega `translate-y-0` / `-translate-y-2` para
 * recuar ao descer, e no Tailwind v4 essas classes compilam para a
 * propriedade CSS `translate`, que torna o elemento um bloco de contenção para
 * descendentes `fixed`. Com o painel dentro do header ele cobria a CAIXA DO
 * HEADER, ou seja, uma faixa de uns cento e cinquenta pixels, com a página
 * aparecendo por baixo. Nada falhava: sem erro no console, sem erro de tipo, e
 * o menu abria.
 *
 * É a mesma família de armadilha que já custou uma vez na cortina de transição,
 * onde `scale-y-0` compunha com o transform do GSAP em vez de ser sobrescrito
 * por ele. Por isso a asserção aqui é sobre a CAIXA do painel, medida contra o
 * viewport, e não sobre ele estar visível: visível ele estava.
 *
 * Roda no projeto `mobile-chrome` (Pixel 5). O botão é `md:hidden`, então num
 * viewport de desktop não há o que clicar.
 */

import { test, expect } from "@playwright/test";

const PORTA = process.env.E2E_PORT ?? 3001;
const APEX = `http://localhost:${PORTA}`;

test.describe("MOBILE-INDICE-01: o índice do site da empresa", () => {
  test("cobre a tela inteira, e não a caixa do cabeçalho", async ({ page }) => {
    await page.goto(`${APEX}/sobre`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /menu/i }).click();
    const indice = page.locator("#indice-empresa");
    await expect(indice).toBeVisible();

    // A animação de entrada é um `y` de -100% a 0, então a caixa só vale a
    // medida depois que ela assenta.
    await page.waitForTimeout(900);

    const medida = await indice.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        topo: r.top,
        altura: r.height,
        largura: r.width,
        janelaAltura: window.innerHeight,
        janelaLargura: window.innerWidth,
      };
    });

    expect(medida.topo).toBeLessThanOrEqual(1);
    expect(medida.altura).toBeGreaterThanOrEqual(medida.janelaAltura - 1);
    expect(medida.largura).toBeGreaterThanOrEqual(medida.janelaLargura - 1);

    // Os quatro destinos estão lá, e por extenso: um índice que abre vazio
    // passaria nas medidas acima.
    await expect(indice.getByRole("link", { name: /Manifesto/ })).toBeVisible();
    await expect(indice.getByRole("link", { name: /Produtos/ })).toBeVisible();
  });

  test("fecha no Escape e leva para o destino escolhido", async ({ page }) => {
    await page.goto(`${APEX}/sobre`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /menu/i }).click();
    await expect(page.locator("#indice-empresa")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#indice-empresa")).toHaveCount(0);

    await page.getByRole("button", { name: /menu/i }).click();
    await page.waitForTimeout(900);
    await page
      .locator("#indice-empresa")
      .getByRole("link", { name: /Manifesto/ })
      .click();

    await page.waitForURL(`${APEX}/manifesto`);
    // Fechado na chegada, senão o índice fica por cima da página nova.
    await expect(page.locator("#indice-empresa")).toHaveCount(0);
  });

  /**
   * A rolagem da página fica travada enquanto o índice está aberto.
   *
   * Duas metades, porque há dois donos possíveis do scroll: o Lenis, quando
   * existe, e o navegador. `setScrollLocked` aplica as duas, e o que se mede
   * aqui é o resultado: a página não anda.
   */
  test("trava a rolagem enquanto está aberto", async ({ page }) => {
    await page.goto(`${APEX}/sobre`);
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /menu/i }).click();
    await page.waitForTimeout(900);

    const antes = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(700);
    const depois = await page.evaluate(() => window.scrollY);

    expect(Math.abs(depois - antes)).toBeLessThan(5);
  });
});
