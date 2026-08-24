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

    const card = page.getByTestId("transaction-card").first();
    const cardCount = await page.getByTestId("transaction-card").count();
    test.skip(cardCount === 0, "nenhum lançamento agrupado no seed");

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
