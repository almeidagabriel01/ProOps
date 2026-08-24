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
  "/profile",
  "/settings",
];

/** Folga de 1px para arredondamento de subpixel do layout. */
const TOLERANCE_PX = 1;

interface OverflowReport {
  reachedRoute: boolean;
  url: string;
  mainScrollWidth: number;
  mainClientWidth: number;
  docScrollWidth: number;
  docClientWidth: number;
  /** Os piores elementos que ultrapassam a largura do main, para diagnóstico. */
  offenders: { selector: string; width: number }[];
}

async function measure(page: Page, route: string): Promise<OverflowReport> {
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

      const offenders: { selector: string; width: number }[] = [];
      if (main) {
        const limit = main.clientWidth + tolerance;
        for (const el of Array.from(main.querySelectorAll<HTMLElement>("*"))) {
          const rect = el.getBoundingClientRect();
          if (rect.width <= limit) continue;
          if (rect.width === 0 || rect.height === 0) continue;
          const style = window.getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none") continue;
          offenders.push({ selector: describe(el), width: Math.round(rect.width) });
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

test.describe("MOBILE-01 sem overflow horizontal", () => {
  for (const route of ROUTES) {
    test(`${route} cabe na largura do viewport`, async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto(route);

      // Espera o shell montar; rotas bloqueadas por plano/permissão redirecionam.
      await authenticatedPage
        .locator("main#main-content")
        .waitFor({ state: "attached", timeout: 20000 });
      await authenticatedPage.waitForLoadState("networkidle").catch(() => {});

      const report = await measure(authenticatedPage, route);

      test.skip(
        !report.reachedRoute,
        `rota indisponível para o usuário de teste (foi para ${report.url})`,
      );

      const detail =
        report.offenders.length > 0
          ? ` Elementos mais largos que o main: ${report.offenders
              .map((o) => `${o.selector} (${o.width}px)`)
              .join(", ")}`
          : "";

      expect(
        report.mainScrollWidth,
        `${route}: o conteúdo do <main> mede ${report.mainScrollWidth}px numa área de ${report.mainClientWidth}px.${detail}`,
      ).toBeLessThanOrEqual(report.mainClientWidth + TOLERANCE_PX);

      expect(
        report.docScrollWidth,
        `${route}: o documento mede ${report.docScrollWidth}px numa área de ${report.docClientWidth}px.`,
      ).toBeLessThanOrEqual(report.docClientWidth + TOLERANCE_PX);
    });
  }
});
