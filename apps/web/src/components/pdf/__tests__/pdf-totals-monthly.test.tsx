// @vitest-environment jsdom
/**
 * No PDF (e no link, que usa a mesma renderização), o total é da venda e a
 * mensalidade aparece embaixo, por mês.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PdfTotals } from "../components/pdf-totals";
import { PdfMonthlyBadge } from "../components/pdf-item-type-badge";
import type { ProposalProduct } from "@/types/proposal";

const products = [
  { productId: "c", productName: "Câmera", quantity: 4, unitPrice: 250, total: 1000 },
  { productId: "m", productName: "Monitoramento", quantity: 1, unitPrice: 129, total: 129, isMonthly: true },
] as ProposalProduct[];

function norm(text: string | null | undefined) {
  return (text ?? "").replace(/\s/g, " ");
}

describe("PdfTotals", () => {
  it("o total não soma a mensalidade, que sai à parte por mês", () => {
    render(<PdfTotals products={products} discount={0} monthlyAmount={129} contentStyles={{}} />);
    expect(norm(screen.getByText("Total:").nextElementSibling?.textContent)).toBe("R$ 1.000,00");
    expect(norm(screen.getByText("Mensalidade:").nextElementSibling?.textContent)).toBe("+R$ 129,00/mês");
  });

  it("sem mensalidade, a linha não aparece", () => {
    render(<PdfTotals products={[products[0]]} discount={0} contentStyles={{}} />);
    expect(screen.queryByText("Mensalidade:")).not.toBeInTheDocument();
  });
});

describe("mensalidade com os preços unitários escondidos", () => {
  it("o total diz quais itens são mensais", () => {
    render(
      <PdfTotals
        products={[products[0]]}
        discount={0}
        monthlyAmount={168.8}
        monthlyItems={["Monitoramento 24h", "Aplicativo", "Suporte"]}
        contentStyles={{}}
      />,
    );
    expect(screen.getByText("Cobrados todo mês: Monitoramento 24h, Aplicativo e Suporte.")).toBeInTheDocument();
  });

  it("um item só, no singular", () => {
    render(<PdfTotals products={[]} discount={0} monthlyAmount={129} monthlyItems={["Monitoramento 24h"]} contentStyles={{}} />);
    expect(screen.getByText("Cobrado todo mês: Monitoramento 24h.")).toBeInTheDocument();
  });

  it("o selo MENSAL aparece na linha do item mesmo sem o preço", () => {
    const { container } = render(<PdfMonthlyBadge />);
    expect(container.querySelector('[data-pdf-item-monthly-tag="1"]')).toHaveTextContent("MENSAL");
  });
});
