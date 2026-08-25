import { test, expect } from "../fixtures/auth.fixture";
import type { Page } from "@playwright/test";

/**
 * MOBILE-03 — o padding das linhas de lista, medido nos dois viewports.
 *
 * Existe por causa de duas regressões reais, espelhadas, na mesma linha de CSS:
 *
 * 1. `CardContent` ganhou `sm:p-6 sm:pt-0` para reduzir padding no celular. O
 *    `sm:pt-0`, por estar numa media query, venceu o `py-4 px-4` sem prefixo
 *    que o `DataTable` passa — padding-top 0 nas listas do DESKTOP.
 * 2. A correção moveu tudo para `max-sm:`, e aí o `max-sm:pt-0` venceu o `p-4`
 *    do `MobileCardRow` — padding-top 0 nos cards do MOBILE.
 *
 * A regra: uma variante (`sm:` ou `max-sm:`) num componente base sobrepõe o
 * override sem prefixo do call site, porque tailwind-merge só desempata dentro
 * do mesmo grupo e a media query ganha no navegador. Por isso `pt-0` fica sem
 * prefixo em `CardContent` e a redução mobile cobre só `px`/`pb`.
 *
 * Ler o CSS não pega nenhum dos dois casos — só medir o padding computado.
 */

const TARGETS = [
  { route: "/proposals", sel: 'a[href^="/proposals/"]:not([href$="/new"])' },
  { route: "/contacts", sel: 'a[href^="/contacts/"]:not([href$="/new"])' },
  { route: "/products", sel: 'a[href^="/products/"]:not([href$="/new"])' },
];

interface Padding {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

async function measureRow(
  page: Page,
  route: string,
  selector: string,
): Promise<Padding | null> {
  await page.goto(route);
  await page
    .locator("main#main-content")
    .waitFor({ state: "attached", timeout: 20000 });
  await page.waitForTimeout(2500);

  return page.evaluate((sel) => {
    const link = document.querySelector<HTMLElement>(
      `main#main-content ${sel}`,
    );
    if (!link) return null;
    // Sobe do link do item até o container da linha (o CardContent).
    // Pegar "o primeiro div com display:grid" acertava os cards de métrica
    // que existem acima da tabela em /products.
    let row: HTMLElement | null = link.parentElement;
    while (row && !/(^|\s)(grid|flex)(\s|$)/.test(getComputedStyle(row).display)) {
      row = row.parentElement;
    }
    // Sobe mais um nível se o encontrado não tiver padding próprio.
    while (row && getComputedStyle(row).paddingTop === "0px") {
      const parent: HTMLElement | null = row.parentElement;
      if (!parent || parent.tagName === "MAIN") break;
      const cs = getComputedStyle(parent);
      if (cs.paddingTop !== "0px") {
        row = parent;
        break;
      }
      row = parent;
    }
    if (!row) return null;
    const cs = getComputedStyle(row);
    return {
      top: cs.paddingTop,
      right: cs.paddingRight,
      bottom: cs.paddingBottom,
      left: cs.paddingLeft,
    };
  }, selector);
}

function assertRowPadding(route: string, label: string, p: Padding | null) {
  expect(p, `${route} @ ${label}: nenhuma linha encontrada`).not.toBeNull();
  // Simétrico é o que importa: topo igual à base. Foi a assimetria (0 em cima,
  // 16 embaixo) que apareceu nas duas regressões.
  expect(
    p!.top,
    `${route} @ ${label}: paddingTop=${p!.top} vs paddingBottom=${p!.bottom} — conteúdo colado no topo`,
  ).toBe(p!.bottom);
  expect(p!.top, `${route} @ ${label}: paddingTop`).not.toBe("0px");
}

test.describe("MOBILE-03 padding das linhas — desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("linhas de lista mantêm padding simétrico a 1280px", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(120000);
    for (const { route, sel } of TARGETS) {
      const p = await measureRow(page, route, sel);
      console.log(`[desktop] ${route}: top=${p?.top} bottom=${p?.bottom}`);
      assertRowPadding(route, "1280px", p);
    }
  });
});

test.describe("MOBILE-03 padding das linhas — mobile", () => {
  test("cards de lista mantêm padding simétrico a 393px", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(120000);
    for (const { route, sel } of TARGETS) {
      const p = await measureRow(page, route, sel);
      console.log(`[mobile] ${route}: top=${p?.top} bottom=${p?.bottom}`);
      assertRowPadding(route, "393px", p);
    }
  });
});
