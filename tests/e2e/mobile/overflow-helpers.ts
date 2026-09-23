import type { Page } from "@playwright/test";

/**
 * Medição de vazamento horizontal no celular, compartilhada pelos specs de
 * `tests/e2e/mobile/`. Extraída de `no-overflow.spec.ts` para o painel do super
 * admin (`admin-no-overflow.spec.ts`) medir do mesmo jeito, sem uma segunda
 * implementação da régua.
 */

/** Folga de 1px para arredondamento de subpixel do layout. */
export const TOLERANCE_PX = 1;

export interface Measurement {
  reachedRoute: boolean;
  url: string;
  mainScrollWidth: number;
  mainClientWidth: number;
  docScrollWidth: number;
  docClientWidth: number;
  /** Os elementos mais largos que a área do main, para diagnóstico. */
  offenders: { selector: string; width: number }[];
  /**
   * Os `transform` inline dentro do main, concatenados. É onde o framer-motion
   * escreve as entradas animadas (`x: 20 → 0`); enquanto isso muda, a medida
   * ainda está no meio de uma animação.
   */
  motionSignature: string;
}

export async function measure(page: Page, route: string): Promise<Measurement> {
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

      const motionSignature = main
        ? Array.from(main.querySelectorAll<HTMLElement>("[style*='transform']"))
            .map((el) => el.style.transform)
            .join("|")
        : "";

      return {
        reachedRoute: window.location.pathname.startsWith(route),
        url: window.location.pathname,
        mainScrollWidth: main?.scrollWidth ?? 0,
        mainClientWidth: main?.clientWidth ?? 0,
        docScrollWidth: doc.scrollWidth,
        docClientWidth: doc.clientWidth,
        offenders: offenders.slice(0, 5),
        motionSignature,
      };
    },
    { route, tolerance: TOLERANCE_PX },
  );
}

/**
 * Mede até a largura do conteúdo E os transforms animados repetirem entre duas
 * amostras.
 *
 * Não dá para usar `waitForLoadState("networkidle")`: os listeners em tempo
 * real do Firestore mantêm conexões abertas e o estado idle nunca chega.
 *
 * Só a largura não bastava. O `getBoundingClientRect` e o `scrollWidth` contam
 * o transform, e várias telas entram deslizando da direita: o botão "Nova
 * Solução" de `/solutions` tem largura total no celular e entra com `x: 20`.
 * Ele aparece só depois do carregamento, então a medição pegava a cauda da
 * animação com o botão ainda 4px além da borda, e o spec falhava de forma
 * intermitente numa tela que em repouso cabe.
 */
export async function measureWhenSettled(
  page: Page,
  route: string,
): Promise<Measurement> {
  let previous = await measure(page, route);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.waitForTimeout(400);
    const current = await measure(page, route);
    if (
      current.mainScrollWidth === previous.mainScrollWidth &&
      current.mainClientWidth === previous.mainClientWidth &&
      current.motionSignature === previous.motionSignature
    ) {
      return current;
    }
    previous = current;
  }
  return previous;
}

export function describeOffenders(report: Measurement): string {
  if (report.offenders.length === 0) return "";
  return ` Mais largos que o main: ${report.offenders
    .map((o) => `${o.selector} (${o.width}px)`)
    .join(", ")}`;
}
