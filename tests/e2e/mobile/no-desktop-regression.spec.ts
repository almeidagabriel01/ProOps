import { test, expect } from "../fixtures/auth.fixture";

/**
 * MOBILE-03 — o trabalho de mobile não pode regredir o desktop.
 *
 * Existe por causa de uma regressão real: `CardContent` ganhou `sm:p-6 sm:pt-0`
 * para reduzir padding no celular, e o `sm:pt-0` — por estar numa media query —
 * passou a vencer o `py-4 px-4` sem prefixo que o DataTable passa no className.
 * O resultado foi padding-top 0 nas linhas de TODAS as listas no desktop.
 *
 * A lição: variante `sm:` num componente base sobrepõe o override do call site;
 * `max-sm:` não, porque não existe de sm para cima. Este teste mede o padding
 * real a 1280px, que é o único jeito de pegar isso — ler o CSS não basta.
 */
test.use({ viewport: { width: 1280, height: 800 } });

test("padding das linhas do DataTable no desktop", async ({
  authenticatedPage: page,
}) => {
  test.setTimeout(120000);

  // Subir a partir do link do item é a única forma confiável de achar a LINHA:
  // pegar o primeiro div com display:grid acertava os cards de métrica que
  // existem acima da tabela em /products.
  const TARGETS = [
    { route: "/proposals", sel: 'a[href^="/proposals/"]:not([href$="/new"])' },
    { route: "/contacts", sel: 'a[href^="/contacts/"]:not([href$="/new"])' },
    { route: "/products", sel: 'a[href^="/products/"]:not([href$="/new"])' },
  ];

  for (const { route, sel } of TARGETS) {
    await page.goto(route);
    await page
      .locator("main#main-content")
      .waitFor({ state: "attached", timeout: 20000 });
    await page.waitForTimeout(2500);

    const result = await page.evaluate((selector) => {
      const link = document.querySelector<HTMLElement>(
        `main#main-content ${selector}`,
      );
      if (!link) return null;
      // Sobe até o CardContent da linha (o primeiro ancestral com grid).
      let row: HTMLElement | null = link.parentElement;
      while (row && getComputedStyle(row).display !== "grid") {
        row = row.parentElement;
      }
      if (!row) return null;
      const cs = getComputedStyle(row);
      return {
        top: cs.paddingTop,
        right: cs.paddingRight,
        bottom: cs.paddingBottom,
        left: cs.paddingLeft,
      };
    }, sel);

    console.log(
      `${route}: paddingTop=${result?.top} bottom=${result?.bottom} left=${result?.left} right=${result?.right}`,
    );

    expect(result, `${route}: nenhuma linha de grade encontrada`).not.toBeNull();
    // O call site pede py-4 px-4 = 16px em todos os lados.
    expect(result!.top, `${route}: paddingTop`).toBe("16px");
    expect(result!.bottom, `${route}: paddingBottom`).toBe("16px");
  }
});
