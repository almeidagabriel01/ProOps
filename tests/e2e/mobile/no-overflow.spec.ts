import { test, expect } from "../fixtures/auth.fixture";
import type { Page } from "@playwright/test";

/**
 * MOBILE-01 — nenhuma rota autenticada pode vazar na horizontal.
 *
 * O shell tem `overflow-hidden` no container externo, então um conteúdo largo
 * demais não gera scroll no documento: ele é simplesmente cortado. Foi assim
 * que o grid de lançamentos (7 trilhas fixas, ~662px) ficou quebrado sem que
 * nada acusasse. Por isso a asserção principal é sobre o `<main>`, que é o
 * elemento que de fato rola.
 *
 * Todas as rotas são medidas num único teste: o fixture de autenticação faz
 * login pela UI, e repetir isso por rota levava a suíte a 17 min. Aqui as
 * violações são acumuladas e reportadas juntas, então uma execução mostra
 * todas as telas quebradas de uma vez em vez de parar na primeira.
 */

const ROUTES = [
  "/dashboard",
  "/proposals",
  "/contacts",
  "/products",
  "/services",
  "/transactions",
  "/wallets",
  "/calendar",
  "/spreadsheets",
  "/automation",
  "/crm",
  "/settings/team",
  "/solutions",
  "/ambientes",
  "/profile",
  "/settings",
  // Formulários — os fluxos mais longos do ERP e os mais usados no celular.
  "/proposals/new",
  "/transactions/new",
  "/contacts/new",
  "/products/new",
];

/** Folga de 1px para arredondamento de subpixel do layout. */
const TOLERANCE_PX = 1;

interface Measurement {
  reachedRoute: boolean;
  url: string;
  mainScrollWidth: number;
  mainClientWidth: number;
  docScrollWidth: number;
  docClientWidth: number;
  /** Os elementos mais largos que a área do main, para diagnóstico. */
  offenders: { selector: string; width: number }[];
}

async function measure(page: Page, route: string): Promise<Measurement> {
  return page.evaluate(
    ({ route, tolerance }) => {
      const main = document.querySelector<HTMLElement>("main#main-content");
      const doc = document.documentElement;

      const describe = (el: Element): string => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const testid = el.getAttribute("data-testid");
        const cls = (el.getAttribute("class") || "")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 4)
          .join(".");
        return `${tag}${id}${testid ? `[data-testid=${testid}]` : ""}${cls ? `.${cls}` : ""}`;
      };

      // Um elemento pode não ser mais largo que o main e ainda assim vazar,
      // por estar posicionado além da borda direita (dentro de um flex que
      // transborda, por exemplo). Os dois casos são reportados.
      const offenders: { selector: string; width: number }[] = [];
      if (main) {
        const mainRect = main.getBoundingClientRect();
        const limit = main.clientWidth + tolerance;
        for (const el of Array.from(main.querySelectorAll<HTMLElement>("*"))) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const tooWide = rect.width > limit;
          const spillsRight = rect.right > mainRect.right + tolerance;
          if (!tooWide && !spillsRight) continue;
          const style = window.getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") continue;
          offenders.push({
            selector: `${describe(el)}${spillsRight && !tooWide ? " [vaza à direita]" : ""}`,
            width: Math.round(tooWide ? rect.width : rect.right - mainRect.left),
          });
        }
      }

      offenders.sort((a, b) => b.width - a.width);

      return {
        reachedRoute: window.location.pathname.startsWith(route),
        url: window.location.pathname,
        mainScrollWidth: main?.scrollWidth ?? 0,
        mainClientWidth: main?.clientWidth ?? 0,
        docScrollWidth: doc.scrollWidth,
        docClientWidth: doc.clientWidth,
        offenders: offenders.slice(0, 5),
      };
    },
    { route, tolerance: TOLERANCE_PX },
  );
}

/**
 * Mede até a largura do conteúdo repetir entre duas amostras.
 *
 * Não dá para usar `waitForLoadState("networkidle")`: os listeners em tempo
 * real do Firestore mantêm conexões abertas e o estado idle nunca chega.
 */
async function measureWhenSettled(
  page: Page,
  route: string,
): Promise<Measurement> {
  let previous = await measure(page, route);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.waitForTimeout(400);
    const current = await measure(page, route);
    if (
      current.mainScrollWidth === previous.mainScrollWidth &&
      current.mainClientWidth === previous.mainClientWidth
    ) {
      return current;
    }
    previous = current;
  }
  return previous;
}

function describeOffenders(report: Measurement): string {
  if (report.offenders.length === 0) return "";
  return ` Mais largos que o main: ${report.offenders
    .map((o) => `${o.selector} (${o.width}px)`)
    .join(", ")}`;
}

test.describe("MOBILE-01 sem overflow horizontal", () => {
  test("todas as rotas autenticadas cabem na largura do viewport", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(180000);

    const violations: string[] = [];
    const skipped: string[] = [];

    for (const route of ROUTES) {
      await page.goto(route);
      await page
        .locator("main#main-content")
        .waitFor({ state: "attached", timeout: 20000 });

      const report = await measureWhenSettled(page, route);

      if (!report.reachedRoute) {
        skipped.push(`${route} -> ${report.url}`);
        continue;
      }

      if (report.mainScrollWidth > report.mainClientWidth + TOLERANCE_PX) {
        const detail = describeOffenders(report);
        violations.push(
          `${route}: conteúdo do <main> mede ${report.mainScrollWidth}px numa área de ${report.mainClientWidth}px.${detail}`,
        );
      }

      if (report.docScrollWidth > report.docClientWidth + TOLERANCE_PX) {
        violations.push(
          `${route}: o documento mede ${report.docScrollWidth}px numa área de ${report.docClientWidth}px.`,
        );
      }
    }

    if (skipped.length > 0) {
      console.log(
        `[MOBILE-01] rotas indisponíveis para o usuário de teste: ${skipped.join(", ")}`,
      );
    }

    expect(
      violations,
      `Overflow horizontal em ${violations.length} rota(s):\n  - ${violations.join("\n  - ")}`,
    ).toEqual([]);
  });

  test("a visão Agrupados não vaza, nem com um lançamento expandido", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(120000);

    await page.goto("/transactions");
    await page
      .locator("main#main-content")
      .waitFor({ state: "attached", timeout: 20000 });

    // Agrupados e o corpo expandido são estado de UI, não rota — por isso
    // escapavam do teste por rota e a sobreposição só apareceu no uso real.
    const agrupados = page.getByRole("button", { name: /Agrupados/i }).first();
    await agrupados.waitFor({ state: "visible", timeout: 20000 });
    await agrupados.click();

    const collapsed = await measureWhenSettled(page, "/transactions");
    expect(
      collapsed.mainScrollWidth,
      `Agrupados fechado: ${collapsed.mainScrollWidth}px numa área de ${collapsed.mainClientWidth}px.${describeOffenders(collapsed)}`,
    ).toBeLessThanOrEqual(collapsed.mainClientWidth + TOLERANCE_PX);

    // O seed não cria transaction_groups, então nem sempre há card para
    // expandir. Sair aqui em vez de test.skip preserva a asserção da visão
    // fechada acima, que é um gate real.
    const cardCount = await page.getByTestId("transaction-card").count();
    if (cardCount === 0) {
      console.log(
        "[MOBILE-01] sem lançamento agrupado no seed — só a visão fechada foi medida",
      );
      return;
    }

    const card = page.getByTestId("transaction-card").first();
    await card.click();
    await page.waitForTimeout(1200);

    const expanded = await measureWhenSettled(page, "/transactions");
    expect(
      expanded.mainScrollWidth,
      `Agrupados expandido: ${expanded.mainScrollWidth}px numa área de ${expanded.mainClientWidth}px.${describeOffenders(expanded)}`,
    ).toBeLessThanOrEqual(expanded.mainClientWidth + TOLERANCE_PX);
  });

  test("o título da página não é coberto por nenhum botão", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(180000);

    // Sobreposição não gera overflow: o botão cabe na largura e ainda assim
    // fica por cima do título quando ele quebra em duas linhas. Por isso este
    // caso é separado do MOBILE-01.
    const violations: string[] = [];

    for (const route of ROUTES) {
      await page.goto(route);
      await page
        .locator("main#main-content")
        .waitFor({ state: "attached", timeout: 20000 });
      await page.waitForTimeout(1200);

      const found = await page.evaluate(() => {
        const heading = document.querySelector<HTMLElement>("main#main-content h1");
        if (!heading) return null;
        const h = heading.getBoundingClientRect();
        if (h.width === 0 || h.height === 0) return null;

        const overlaps: string[] = [];
        const controls = document.querySelectorAll<HTMLElement>(
          "main#main-content button, main#main-content a",
        );
        for (const el of Array.from(controls)) {
          // Ignora quem contém o título ou está dentro dele.
          if (el.contains(heading) || heading.contains(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const style = window.getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") continue;

          const intersects =
            r.left < h.right - 1 &&
            r.right > h.left + 1 &&
            r.top < h.bottom - 1 &&
            r.bottom > h.top + 1;
          if (intersects) {
            overlaps.push(
              `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 30)}"`,
            );
          }
        }
        return { title: (heading.textContent || "").trim().slice(0, 40), overlaps };
      });

      if (found && found.overlaps.length > 0) {
        violations.push(
          `${route}: o título "${found.title}" é coberto por ${found.overlaps.join(", ")}`,
        );
      }
    }

    expect(
      violations,
      `Sobreposição sobre o título em ${violations.length} rota(s): ${violations.join(" | ")}`,
    ).toEqual([]);
  });

  test("nome muito longo não quebra o card nem estoura a largura", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(120000);

    // O seed tem nomes curtos, então o layout nunca é exercitado no pior caso.
    // Aqui o texto é injetado no DOM: uma frase longa (quebra em espaços) e uma
    // sequência sem espaço nenhum, que é o caso que line-clamp sozinho não
    // resolve — só overflow-wrap resolve.
    const CASES = [
      "Projeto, Instalação e Configuração do Sistema de Som Multizona com Assistente Virtual Integrado para Áreas Comuns e Privativas",
      "SKU" + "X".repeat(90),
    ];

    // O seletor precisa ser o link de detalhe do ITEM. Pegar o primeiro
    // a[href] do <main> acertava o botão do cabeçalho e media outra coisa.
    const TARGETS: { route: string; selector: string }[] = [
      // :not([href$="/new"]) é essencial — /products/new também casa com o
      // prefixo e o alvo virava o botão "Novo Produto" do cabeçalho.
      { route: "/products", selector: 'a[href^="/products/"]:not([href$="/new"])' },
      { route: "/services", selector: 'a[href^="/services/"]:not([href$="/new"])' },
      { route: "/proposals", selector: 'a[href^="/proposals/"]:not([href$="/new"])' },
    ];

    const measured: string[] = [];
    const noItems: string[] = [];

    for (const { route, selector } of TARGETS) {
      await page.goto(route);
      await page
        .locator("main#main-content")
        .waitFor({ state: "attached", timeout: 20000 });
      await page.waitForTimeout(1500);

      for (const text of CASES) {
        const result = await page.evaluate(({ longText, sel }) => {
          const main = document.querySelector<HTMLElement>("main#main-content");
          if (!main) return null;
          const link = main.querySelector<HTMLElement>(sel);
          if (!link) return null;
          const original = link.textContent;
          link.textContent = longText;
          const measured = {
            mainScrollWidth: main.scrollWidth,
            mainClientWidth: main.clientWidth,
            linkWidth: Math.round(link.getBoundingClientRect().width),
          };
          link.textContent = original;
          return measured;
        }, { longText: text, sel: selector });

        // Rota sem itens no seed não pode ser medida. Registrar em vez de
        // passar em silêncio — a asserção final garante que ao menos uma rota
        // foi realmente exercitada.
        if (!result) {
          if (!noItems.includes(route)) noItems.push(route);
          continue;
        }
        if (!measured.includes(route)) measured.push(route);

        expect(
          result.mainScrollWidth,
          `${route} com nome de ${text.length} caracteres: <main> mede ${result.mainScrollWidth}px numa área de ${result.mainClientWidth}px`,
        ).toBeLessThanOrEqual(result.mainClientWidth + TOLERANCE_PX);

        expect(
          result.linkWidth,
          `${route}: o texto longo mede ${result.linkWidth}px, mais que a área de ${result.mainClientWidth}px`,
        ).toBeLessThanOrEqual(result.mainClientWidth);
      }
    }

    if (noItems.length > 0) {
      console.log(
        `[MOBILE-01] rotas sem itens no seed, não medidas: ${noItems.join(", ")}`,
      );
    }
    expect(
      measured.length,
      `nenhuma rota pôde ser medida (sem itens no seed): ${noItems.join(", ")}`,
    ).toBeGreaterThan(0);
  });

  test("botões de ação do cabeçalho ocupam a largura toda", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(180000);

    // Padronização pedida: no celular, todo botão de ação do topo ocupa a
    // linha inteira. Sem isto cada página nova volta a divergir.
    const ROUTES_WITH_ACTIONS = [
      "/proposals",
      "/transactions",
      "/contacts",
      "/products",
      "/services",
      "/wallets",
      "/spreadsheets",
    ];

    const violations: string[] = [];

    for (const route of ROUTES_WITH_ACTIONS) {
      await page.goto(route);
      await page
        .locator("main#main-content")
        .waitFor({ state: "attached", timeout: 20000 });
      await page.waitForTimeout(1500);

      const found = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>("main#main-content");
        const heading = main?.querySelector<HTMLElement>("h1");
        if (!main || !heading) return null;

        // Área do cabeçalho: tudo acima do primeiro campo de busca.
        const search = main.querySelector<HTMLElement>("input");
        const limit = search
          ? search.getBoundingClientRect().top
          : heading.getBoundingClientRect().bottom + 200;

        // clientWidth inclui o padding do <main>; o alvo é a largura de
        // CONTEÚDO, que é o que um botão w-full de fato ocupa.
        const mainStyle = window.getComputedStyle(main);
        const available =
          main.clientWidth -
          parseFloat(mainStyle.paddingLeft || "0") -
          parseFloat(mainStyle.paddingRight || "0");
        const narrow: { label: string; width: number }[] = [];

        const controls = Array.from(
          main.querySelectorAll<HTMLElement>("a, button"),
        );
        for (const el of controls) {
          const r = el.getBoundingClientRect();
          if (r.height === 0 || r.width === 0) continue;
          if (r.top >= limit) continue;
          if (r.top < heading.getBoundingClientRect().top) continue;
          // Só botões de ação de verdade: altura de botão lg.
          if (r.height < 40) continue;
          const label = (el.textContent || "").trim().slice(0, 24);
          if (!label) continue;
          if (r.width < available - 8) {
            narrow.push({ label, width: Math.round(r.width) });
          }
        }
        return { available, narrow };
      });

      if (found && found.narrow.length > 0) {
        violations.push(
          `${route}: ${found.narrow
            .map((b) => `"${b.label}" ${b.width}px de ${found.available}px`)
            .join("; ")}`,
        );
      }
    }

    expect(
      violations,
      `Botões do cabeçalho sem largura total em ${violations.length} rota(s): ${violations.join(" | ")}`,
    ).toEqual([]);
  });

  test("o painel da Lia não é mais largo que a tela", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/dashboard");

    const trigger = page.getByRole("button", { name: "Abrir Lia" });
    if ((await trigger.count()) === 0) {
      test.skip(true, "Lia indisponível para o plano do usuário de teste");
    }

    await trigger.click();

    const panel = page.getByRole("complementary", { name: "Assistente Lia" });
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();

    expect(
      Math.round(box!.width),
      `o painel mede ${box?.width}px num viewport de ${viewport?.width}px`,
    ).toBeLessThanOrEqual(viewport!.width);
    expect(box!.x).toBeGreaterThanOrEqual(-1);
  });
});
