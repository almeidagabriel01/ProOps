// @vitest-environment jsdom
/**
 * A chave "Mensal" da linha da proposta: aparece para quem tem contratos no
 * plano, e numa linha que já é mensal sempre (para poder voltar atrás).
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MonthlyLineProvider, MonthlyLineSwitch } from "../monthly-line";
import type { ProposalProduct } from "@/types/proposal";

const line = (over: Partial<ProposalProduct> = {}) =>
  ({
    productId: "s1",
    productName: "Monitoramento",
    itemType: "service",
    quantity: 1,
    unitPrice: 129,
    total: 129,
    lineItemId: "li1",
    systemInstanceId: "sys-amb",
    ...over,
  }) as ProposalProduct;

function renderSwitch(enabled: boolean, product: ProposalProduct, onToggle = vi.fn()) {
  render(
    <MonthlyLineProvider enabled={enabled} onToggle={onToggle}>
      <MonthlyLineSwitch product={product} />
    </MonthlyLineProvider>,
  );
  return onToggle;
}

describe("MonthlyLineSwitch", () => {
  it("sem contratos no plano, a linha comum não mostra a chave", () => {
    renderSwitch(false, line());
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("sem contratos no plano, a linha que já é mensal mostra a chave para desfazer", () => {
    renderSwitch(false, line({ isMonthly: true }));
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("alternar manda a linha certa, com o novo valor", () => {
    const onToggle = renderSwitch(true, line());
    fireEvent.click(screen.getByRole("switch", { name: "Cobrar este item todo mês" }));
    expect(onToggle).toHaveBeenCalledWith("s1", true, "sys-amb", "service", "li1");
  });

  it("fora do formulário (sem provedor), nada aparece", () => {
    render(<MonthlyLineSwitch product={line({ isMonthly: true })} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
