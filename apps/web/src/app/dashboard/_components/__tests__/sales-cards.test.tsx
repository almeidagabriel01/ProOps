// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { SalesSummaryCard } from "../sales-summary-card";
import { ProposalAttentionCard } from "../proposal-attention-card";
import type { AttentionResult } from "@/lib/sales/proposal-attention";

const summary = {
  sold: 15000,
  soldCount: 2,
  ticket: 7500,
  previousSold: 10000,
  deltaPercent: 50,
  openValue: 52000,
  openCount: 4,
};

describe("Vendas do mês", () => {
  it("mostra vendido, variação, negociação, conversão e ticket", () => {
    render(<SalesSummaryCard month="2026-09" summary={summary} conversionRate={38} loading={false} />);
    expect(screen.getByText("Vendas de setembro")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*15\.000/)).toBeInTheDocument();
    expect(screen.getByText("50% contra agosto")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*52\.000/)).toBeInTheDocument();
    expect(screen.getByText("4 propostas com o cliente")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
    expect(screen.getByText("2 vendas no mês")).toBeInTheDocument();
  });

  it("queda aparece como queda, e sem mês anterior não há comparação", () => {
    const { rerender } = render(
      <SalesSummaryCard month="2026-09" summary={{ ...summary, deltaPercent: -20 }} conversionRate={0} loading={false} />,
    );
    expect(screen.getByText("20% contra agosto")).toBeInTheDocument();
    rerender(
      <SalesSummaryCard month="2026-01" summary={{ ...summary, deltaPercent: null }} conversionRate={0} loading={false} />,
    );
    expect(screen.getByText("Sem vendas em dezembro")).toBeInTheDocument();
  });

  it("carregando: a mesma grade, sem números", () => {
    render(<SalesSummaryCard month="2026-09" summary={null} conversionRate={0} loading />);
    expect(screen.queryByText("Vendido")).toBeNull();
  });

  it("falhou: avisa em vez de mostrar zero", () => {
    render(<SalesSummaryCard month="2026-09" summary={null} conversionRate={0} loading={false} />);
    expect(screen.getByText(/Não foi possível carregar as vendas/)).toBeInTheDocument();
  });

  it("demonstração: exemplo rotulado, mesmo sem dado", () => {
    render(<SalesSummaryCard month="2026-09" summary={null} conversionRate={0} loading isDemo />);
    expect(screen.getByText("Exemplo da conta de demonstração.")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*84\.200/)).toBeInTheDocument();
  });
});

describe("Precisa de atenção", () => {
  const result: AttentionResult = {
    items: [
      {
        id: "a",
        title: "Casa Silva",
        clientName: "Ana",
        reason: "acceptance",
        detail: "Aceite do cliente a confirmar",
        href: "/proposals?aceite=a",
      },
    ],
    counts: { acceptance: 1, change_request: 0, expiring: 0, stale: 7 },
    total: 8,
  };

  it("lista o que pede ação, com o link de cada uma e o resumo por motivo", () => {
    render(<ProposalAttentionCard result={result} loading={false} />);
    expect(screen.getByRole("link", { name: /Casa Silva/ })).toHaveAttribute("href", "/proposals?aceite=a");
    expect(screen.getByText("aceite a confirmar")).toBeInTheDocument();
    expect(screen.getByText("paradas há mais de 7 dias")).toBeInTheDocument();
    expect(screen.queryByText(/pedido de mudança/)).toBeNull();
    expect(screen.getByRole("link", { name: "E mais 7 nas propostas" })).toHaveAttribute("href", "/proposals");
  });

  it("nada pendente: diz que está tudo em dia", () => {
    render(
      <ProposalAttentionCard
        result={{ items: [], counts: { acceptance: 0, change_request: 0, expiring: 0, stale: 0 }, total: 0 }}
        loading={false}
      />,
    );
    expect(screen.getByText("Tudo em dia nas propostas")).toBeInTheDocument();
  });

  it("demonstração: exemplo rotulado", () => {
    render(<ProposalAttentionCard result={null} loading isDemo />);
    expect(screen.getByText("Exemplo da conta de demonstração.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Som Ambiente Multizona/ })).toBeInTheDocument();
  });
});
