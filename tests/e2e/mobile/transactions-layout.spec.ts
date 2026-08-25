import { test, expect } from "../fixtures/auth.fixture";
import type { Page } from "@playwright/test";
import { getTestDb } from "../helpers/admin-firestore";

/**
 * MOBILE-05 — os lançamentos no celular usam a largura inteira do card.
 *
 * `CardContent` aplica `max-sm:px-4 max-sm:pb-4`. Por serem media queries elas
 * vencem o `p-0` sem prefixo dos call sites (e o twMerge não as remove, porque
 * modificadores diferentes não conflitam), então:
 *
 *  - na aba Lista sobravam faixas brancas de 16px de cada lado das linhas, e o
 *    título — que já era o primeiro a truncar a 393px — perdia 32px de largura;
 *  - na aba Agrupados o conteúdo ganhava recuo duplo sobre o px da própria
 *    linha, e o bloco de valor/status, que abaixo de md ocupa a linha inteira,
 *    ficava alinhado à direita enquanto título e ações ficavam à esquerda.
 *
 * O contrato aqui é geométrico de propósito: vale para qualquer largura de
 * celular, não só para a do aparelho onde o problema foi visto.
 */

/** Folga de 1px para arredondamento de subpixel. */
const TOLERANCE_PX = 1;

const STANDALONE_ID = "mobile-05-standalone";

interface EdgeMeasurement {
  rowLeft: number;
  rowRight: number;
  cardInnerLeft: number;
  cardInnerRight: number;
  contentPaddingLeft: number;
  contentPaddingRight: number;
}

/**
 * Mede a linha `testId` contra o `Card` que a contém. O Card é o ancestral com
 * a classe `rounded-lg` (única no caminho); entre os dois só existe o
 * CardContent, cujo padding é justamente o que se quer em zero.
 */
async function measureRowAgainstCard(
  page: Page,
  testId: string,
): Promise<EdgeMeasurement | null> {
  return page.evaluate((testId) => {
    const row = document.querySelector<HTMLElement>(
      `[data-testid="${testId}"]`,
    );
    if (!row) return null;

    const target =
      testId === "transaction-card"
        ? // O wrapper do card agrupado é um <div class="group">; a linha que
          // interessa é o cabeçalho dentro do CardContent.
          (row.querySelector<HTMLElement>(
            "[class*='rounded-lg'] > div > div",
          ) ?? row)
        : row;

    const card = target.closest<HTMLElement>("[class~='rounded-lg']");
    if (!card) return null;

    // CardContent é sempre o primeiro filho do Card — é dele que vem o
    // max-sm:px-4 que criava as faixas laterais.
    const content = card.firstElementChild as HTMLElement | null;
    const contentStyle = content ? getComputedStyle(content) : null;
    const cardStyle = getComputedStyle(card);
    const cardRect = card.getBoundingClientRect();
    const rowRect = target.getBoundingClientRect();

    return {
      rowLeft: rowRect.left,
      rowRight: rowRect.right,
      cardInnerLeft: cardRect.left + parseFloat(cardStyle.borderLeftWidth),
      cardInnerRight: cardRect.right - parseFloat(cardStyle.borderRightWidth),
      contentPaddingLeft: contentStyle
        ? parseFloat(contentStyle.paddingLeft)
        : -1,
      contentPaddingRight: contentStyle
        ? parseFloat(contentStyle.paddingRight)
        : -1,
    };
  }, testId);
}

test.describe("MOBILE-05 lançamentos", () => {
  test.beforeAll(async () => {
    // Um avulso (`grouped: false`) é o que a aba Agrupados lista sem depender
    // do trigger de resumo — assim o teste não fica condicionado a ele.
    await getTestDb()
      .collection("transactions")
      .doc(STANDALONE_ID)
      .set({
        tenantId: "tenant-alpha",
        type: "expense",
        status: "pending",
        amount: 3000,
        description: "Aluguel Showroom com nome comprido para truncar",
        wallet: "wallet-alpha-main",
        date: "2026-08-24",
        dueDate: "2026-08-24",
        grouped: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        createdBy: "user-admin-alpha",
      });
  });

  test.afterAll(async () => {
    await getTestDb().collection("transactions").doc(STANDALONE_ID).delete();
  });

  test("Lista: a linha ocupa a largura inteira do card, sem faixas laterais", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/transactions");
    await page
      .getByTestId("transaction-row")
      .first()
      .waitFor({ state: "visible", timeout: 30000 });

    const m = await measureRowAgainstCard(page, "transaction-row");
    expect(m, "nenhuma linha de lançamento renderizou").not.toBeNull();

    expect(
      m!.contentPaddingLeft,
      "CardContent ainda aplica padding lateral no celular (max-sm:px-4)",
    ).toBe(0);
    expect(m!.contentPaddingRight).toBe(0);
    expect(Math.abs(m!.rowLeft - m!.cardInnerLeft)).toBeLessThanOrEqual(
      TOLERANCE_PX,
    );
    expect(Math.abs(m!.rowRight - m!.cardInnerRight)).toBeLessThanOrEqual(
      TOLERANCE_PX,
    );
  });

  test("Agrupados: card sangrado e valor/status alinhados à esquerda como o resto", async ({
    authenticatedPage: page,
  }) => {
    test.setTimeout(120000);

    await page.goto("/transactions");
    const agrupados = page.getByRole("button", { name: /Agrupados/i }).first();
    await agrupados.waitFor({ state: "visible", timeout: 20000 });
    await agrupados.click();

    await page
      .getByTestId("transaction-card")
      .first()
      .waitFor({ state: "visible", timeout: 30000 });

    const m = await measureRowAgainstCard(page, "transaction-card");
    expect(m, "nenhum card agrupado renderizou").not.toBeNull();
    expect(
      m!.contentPaddingLeft,
      "CardContent ainda aplica padding lateral no celular (max-sm:px-4)",
    ).toBe(0);
    expect(Math.abs(m!.rowLeft - m!.cardInnerLeft)).toBeLessThanOrEqual(
      TOLERANCE_PX,
    );

    const alignment = await page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>(
        '[data-testid="transaction-card"]',
      );
      if (!wrapper) return null;
      const row = wrapper.querySelector<HTMLElement>(
        "[class*='rounded-lg'] > div > div",
      );
      if (!row) return null;

      const rowRect = row.getBoundingClientRect();
      const rowContentLeft =
        rowRect.left + parseFloat(getComputedStyle(row).paddingLeft);

      const amountSpan = Array.from(row.querySelectorAll("span")).find((s) =>
        /^R\$/.test((s.textContent ?? "").trim()),
      );
      if (!amountSpan?.parentElement) return null;

      const amountBox = amountSpan.parentElement;
      const amountRect = amountBox.getBoundingClientRect();
      // O bloco do valor tem px-2 compensado por margem negativa; medir a
      // borda do TEXTO evita acoplar o teste a esses valores.
      const amountTextLeft =
        amountRect.left + parseFloat(getComputedStyle(amountBox).paddingLeft);

      const valueBlock = row.querySelector<HTMLElement>(
        "[class*='max-md:justify-between']",
      );
      const buttonLefts = valueBlock
        ? Array.from(valueBlock.querySelectorAll("button")).map(
            (b) => b.getBoundingClientRect().left,
          )
        : [];

      return {
        rowContentLeft,
        rowMiddle: rowRect.left + rowRect.width / 2,
        amountTextLeft,
        maxButtonLeft: buttonLefts.length ? Math.max(...buttonLefts) : null,
      };
    });

    expect(alignment, "não foi possível localizar o valor no card").not.toBeNull();

    expect(
      Math.abs(alignment!.amountTextLeft - alignment!.rowContentLeft),
      `o valor começa em ${alignment!.amountTextLeft}px e o conteúdo da linha em ${alignment!.rowContentLeft}px`,
    ).toBeLessThanOrEqual(4);

    if (alignment!.maxButtonLeft !== null) {
      expect(
        alignment!.maxButtonLeft,
        "o controle de status ainda está empurrado para a direita da linha",
      ).toBeLessThan(alignment!.rowMiddle);
    }
  });
});
