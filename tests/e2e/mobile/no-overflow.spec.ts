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
        const detail =
          report.offenders.length > 0
            ? ` Mais largos que o main: ${report.offenders
                .map((o) => `${o.selector} (${o.width}px)`)
                .join(", ")}`
            : "";
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
