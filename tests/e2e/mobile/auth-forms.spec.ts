import { test, expect } from "../fixtures/base.fixture";
import type { Page } from "@playwright/test";

/**
 * MOBILE-04 — nenhum campo do login/cadastro pode disparar o zoom do iOS.
 *
 * Safari no iOS dá zoom automático ao focar qualquer campo de texto com
 * font-size < 16px, e a página fica deslocada até o usuário afastar com os
 * dedos. O viewport do app é `width=device-width, initial-scale=1` SEM
 * `maximum-scale` (proibir o pinch-zoom quebra acessibilidade), então o único
 * remédio correto é o campo ter 16px no celular.
 *
 * O `Input`/`Textarea` do design system já usam `text-base md:text-sm`; o que
 * escapava eram os `<input>` crus de e-mail/senha em `login/_components/
 * form-fields.tsx` e o `PhoneInput`, todos travados em `text-sm` (14px).
 */

const MIN_FONT_SIZE_PX = 16;

interface SmallField {
  route: string;
  id: string;
  fontSize: number;
}

/** Campos que o iOS considera "de texto" — os que causam o zoom ao focar. */
async function findFieldsBelowMinimum(
  page: Page,
  route: string,
  minimum: number,
): Promise<SmallField[]> {
  return page.evaluate(
    ({ route, minimum }) => {
      const NON_TEXT_TYPES = new Set([
        "hidden",
        "checkbox",
        "radio",
        "range",
        "color",
        "submit",
        "button",
        "image",
        "reset",
      ]);

      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>("input, textarea, select"),
      );

      const offenders: { route: string; id: string; fontSize: number }[] = [];

      for (const node of nodes) {
        if (node instanceof HTMLInputElement && NON_TEXT_TYPES.has(node.type)) {
          continue;
        }
        // O Select custom mantém um <select> sr-only só para acessibilidade; o
        // controle visível é um div, que não dispara zoom.
        const rect = node.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;
        if (node.closest("[aria-hidden='true']")) continue;

        const fontSize = parseFloat(getComputedStyle(node).fontSize);
        if (Number.isNaN(fontSize) || fontSize >= minimum) continue;

        const describe =
          node.id ||
          node.getAttribute("name") ||
          node.getAttribute("placeholder") ||
          `${node.tagName.toLowerCase()}${node instanceof HTMLInputElement ? `[type=${node.type}]` : ""}`;

        offenders.push({ route, id: describe, fontSize });
      }

      return offenders;
    },
    { route, minimum },
  );
}

test.describe("MOBILE-04 formulários de autenticação", () => {
  for (const route of ["/login", "/register"]) {
    test(`os campos de ${route} têm ao menos 16px e não disparam o zoom do iOS`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.locator("#email").waitFor({ state: "visible", timeout: 30000 });

      const offenders = await findFieldsBelowMinimum(
        page,
        route,
        MIN_FONT_SIZE_PX,
      );

      expect(
        offenders,
        `Campos abaixo de ${MIN_FONT_SIZE_PX}px (o iOS dá zoom ao focar):\n  - ${offenders
          .map((o) => `${o.route} ${o.id}: ${o.fontSize}px`)
          .join("\n  - ")}`,
      ).toEqual([]);
    });
  }

  test("o viewport continua permitindo o pinch-zoom", async ({ page }) => {
    // Travar `maximum-scale=1` "resolveria" o zoom ao focar às custas de
    // acessibilidade. Este teste impede essa saída fácil.
    await page.goto("/login");

    const content = await page
      .locator('meta[name="viewport"]')
      .first()
      .getAttribute("content");

    expect(content).toContain("width=device-width");
    expect(content).not.toContain("maximum-scale");
    expect(content).not.toContain("user-scalable=no");
  });

  test("o formulário cabe na altura visível do celular, sem scroll do documento", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 30000 });

    const leak = await page.evaluate(() => ({
      docScrollWidth: document.documentElement.scrollWidth,
      docClientWidth: document.documentElement.clientWidth,
    }));

    expect(leak.docScrollWidth).toBeLessThanOrEqual(leak.docClientWidth + 1);
  });
});
