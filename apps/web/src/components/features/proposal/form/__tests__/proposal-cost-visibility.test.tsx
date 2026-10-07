// @vitest-environment jsdom
/**
 * Custo, markup e lucro na proposta seguem "Ver custo, markup e lucro": a
 * vendedora que o dono deixou montar proposta vê só o valor de venda.
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProposalProduct } from "@/services/proposal-service";

const sensitive = vi.hoisted(() => ({ canSeeCost: true }));
vi.mock("@/hooks/usePermission", () => ({
  useSensitiveData: () => ({ isLoading: false, canSeeCost: sensitive.canSeeCost, canSeeStock: true }),
}));

import { SummaryFooter } from "../summary/summary-footer";
import { ProposalFinancialSummarySmall } from "../proposal-financial-summary-small";
import { proposalLineDisplayUnitPrice, catalogPickerPrice } from "@/lib/proposal/catalog-picker-price";

const lines = [
  { productId: "p1", productName: "Câmera", quantity: 2, unitPrice: 1167, markup: 50, total: 3501 },
] as unknown as ProposalProduct[];

afterEach(() => {
  sensitive.canSeeCost = true;
});

function footer() {
  render(
    <table>
      <SummaryFooter
        selectedProducts={lines}
        subtotal={3501}
        discount={0}
        discountPercentage={0}
        extraExpense={0}
        totalValue={3501}
      />
    </table>,
  );
}

describe("custo e lucro na proposta", () => {
  it("quem vê o custo vê custo bruto e lucro", () => {
    footer();
    expect(screen.getByText(/Custo dos Produtos/)).toBeInTheDocument();
    expect(screen.getByText("Lucro:")).toBeInTheDocument();
  });

  it("sem 'Ver custo', o rodapé mostra só o preço de venda", () => {
    sensitive.canSeeCost = false;
    footer();
    expect(screen.queryByText(/Custo dos Produtos/)).toBeNull();
    expect(screen.queryByText("Lucro:")).toBeNull();
    expect(screen.getByText(/Subtotal \(Preço de Venda\)/)).toBeInTheDocument();
  });

  it("sem 'Ver custo', o resumo do cabeçalho não tem lucro", () => {
    sensitive.canSeeCost = false;
    render(<ProposalFinancialSummarySmall selectedProducts={lines} />);
    expect(screen.getByText("Total:")).toBeInTheDocument();
    expect(screen.queryByText("Lucro:")).toBeNull();
  });

  it("o unitário e o preço do seletor viram o de venda", () => {
    expect(proposalLineDisplayUnitPrice(lines[0], false)).toBe(1750.5);
    expect(proposalLineDisplayUnitPrice(lines[0], true)).toBe(1167);
    expect(catalogPickerPrice({ price: "1167", markup: "50" }, false)).toBe(1750.5);
    expect(catalogPickerPrice({ price: "1167", markup: "50" }, true)).toBe(1167);
  });
});
