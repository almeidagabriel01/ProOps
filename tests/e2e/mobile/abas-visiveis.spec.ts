import { test, expect } from "../fixtures/auth.fixture";
import type { Locator, Page } from "@playwright/test";

/**
 * MOBILE-07 — a aba ativa de uma fileira que rola está À VISTA.
 *
 * O `no-overflow.spec.ts` não enxerga isto: uma fileira que rola por dentro
 * (`overflow-x-auto`) nunca alarga o `<main>`. O defeito relatado foi este:
 * em Lançamentos, tocar "Fluxo de caixa" no seletor do Financeiro abria a
 * página nova com a barra rolada para o começo e a visão escolhida escondida à
 * direita, e parecia que a aba tinha voltado para a primeira. Nas
 * Configurações, `justify-center` num contêiner que rola empurrava o começo
 * para fora pela esquerda, e "Segurança" ficava inalcançável.
 *
 * O contrato é geométrico: o retângulo da opção ativa cabe no da barra.
 */

/** Folga para arredondamento de subpixel. */
const TOLERANCE_PX = 1;

async function activeInsideContainer(
  container: Locator,
  activeSelector: string,
): Promise<{ inside: boolean; detail: string }> {
  return container.evaluate(
    (el, { selector, tolerance }) => {
      const active = el.querySelector<HTMLElement>(selector);
      if (!active) return { inside: false, detail: "sem opção ativa" };
      const box = el.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      const inside =
        item.left >= box.left - tolerance &&
        item.right <= box.right + tolerance;
      return {
        inside,
        detail: `${active.textContent?.trim()}: [${Math.round(item.left)}, ${Math.round(item.right)}] na barra [${Math.round(box.left)}, ${Math.round(box.right)}], scrollLeft ${Math.round(el.scrollLeft)}`,
      };
    },
    { selector: activeSelector, tolerance: TOLERANCE_PX },
  );
}

function viewSwitcher(page: Page, groupLabel: string): Locator {
  return page.getByRole("group", { name: `Visões de ${groupLabel}` });
}

async function expectActiveViewVisible(page: Page, groupLabel: string) {
  const bar = viewSwitcher(page, groupLabel);
  await expect(bar).toBeVisible({ timeout: 20000 });
  await expect
    .poll(async () => activeInsideContainer(bar, '[aria-pressed="true"]'), {
      timeout: 5000,
    })
    .toMatchObject({ inside: true });
}

test.describe("MOBILE-07 aba ativa à vista", () => {
  test("seletor do Financeiro mantém a visão escolhida na tela", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(90000);

    await page.goto("/transactions");
    const bar = viewSwitcher(page, "Financeiro");
    await expect(bar).toBeVisible({ timeout: 20000 });

    // A sexta e a sétima visões ficam fora de um celular sem a rolagem.
    for (const [label, path] of [
      ["Fluxo de caixa", "/cash-flow"],
      ["Metas de vendas", "/goals"],
    ] as const) {
      await viewSwitcher(page, "Financeiro")
        .getByRole("button", { name: label })
        .click();
      await page.waitForURL(`**${path}`, { timeout: 20000 });
      await expectActiveViewVisible(page, "Financeiro");
      await expect(
        viewSwitcher(page, "Financeiro").getByRole("button", {
          name: label,
          pressed: true,
        }),
      ).toBeVisible();
    }
  });

  test("Link de agendamento aparece ativo no seletor da Agenda", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/booking");
    await expectActiveViewVisible(page, "Agenda");
  });

  test("nav de Configurações mostra o item ativo e alcança o primeiro", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings/linked-accounts");
    const nav = page.getByRole("navigation", {
      name: "Navegação de configurações",
    });
    await expect(nav).toBeVisible({ timeout: 20000 });
    const row = nav.locator("> div").first();

    await expect
      .poll(async () => activeInsideContainer(row, '[aria-current="page"]'), {
        timeout: 5000,
      })
      .toMatchObject({ inside: true });

    // Com a rolagem no começo, o primeiro item começa dentro da fileira.
    const firstReachable = await row.evaluate((el) => {
      el.scrollLeft = 0;
      const first = el.querySelector<HTMLElement>("a");
      if (!first) return false;
      return (
        first.getBoundingClientRect().left >=
        el.getBoundingClientRect().left - 1
      );
    });
    expect(firstReachable).toBe(true);
  });
});
