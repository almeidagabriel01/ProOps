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
