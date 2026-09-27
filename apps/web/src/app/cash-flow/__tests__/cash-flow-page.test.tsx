// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  plan: { hasFinancial: true, isLoading: false },
  open: vi.fn(),
  wallets: vi.fn(),
}));

vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="cash-flow-chart" /> }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" }, isLoading: false }) }));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/layout/page-view-switcher", () => ({ PageViewSwitcher: () => null }));
vi.mock("@/components/ui/upgrade-required", () => ({
  UpgradeRequired: ({ feature }: { feature: string }) => <div>upgrade {feature}</div>,
}));
vi.mock("@/services/transaction-service", () => ({
  TransactionService: { getOpenTransactions: (...a: unknown[]) => m.open(...a) },
}));
vi.mock("@/services/wallet-service", () => ({
  WalletService: { getWallets: (...a: unknown[]) => m.wallets(...a) },
}));

import CashFlowPage from "../page";

// Hoje fixo: 26/09/2026 em Brasília.
beforeEach(() => {
  vi.useFakeTimers({ now: Date.UTC(2026, 8, 26, 15), toFake: ["Date"] });
  vi.clearAllMocks();
  window.localStorage.clear();
  m.plan = { hasFinancial: true, isLoading: false };
  m.wallets.mockResolvedValue([
    { id: "w1", status: "active", balance: 1000 },
    { id: "w2", status: "archived", balance: 99999 },
  ]);
  m.open.mockResolvedValue([
    { id: "a", type: "income", status: "pending", amount: 1000, dueDate: "2026-09-28" },
    { id: "b", type: "expense", status: "pending", amount: 2500, dueDate: "2026-10-05" },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fluxo de caixa", () => {
  it("parte das carteiras ativas e mostra o saldo do fim e o menor saldo", async () => {
    render(<CashFlowPage />);
    expect(await screen.findByText("Em 1 carteira")).toBeInTheDocument();
    expect(m.open).toHaveBeenCalledWith("t1");
    // Realista: 95% da receita, 15 dias depois (vai para outubro).
    // Outubro: 1000 + 950 - 2500 = -550.
    expect(screen.getByText(/o caixa fica negativo em out\/26/)).toBeInTheDocument();
  });

  it("otimista recebe tudo no vencimento", async () => {
    render(<CashFlowPage />);
    await screen.findByText("Em 1 carteira");
    await userEvent.click(screen.getByRole("button", { name: "Otimista" }));
    // Setembro: 1000 + 1000 = 2000; outubro: 2000 - 2500 = -500.
    expect(screen.getByText(/No cenário otimista o caixa fica negativo em out\/26/)).toBeInTheDocument();
  });

  it("ajustar o cenário recalcula na hora e fica guardado no navegador", async () => {
    render(<CashFlowPage />);
    await screen.findByText("Em 1 carteira");
    const rate = screen.getByLabelText("Recebe (%)");
    fireEvent.change(rate, { target: { value: "0" } });
    expect(JSON.parse(window.localStorage.getItem("proops:cash-flow-scenarios") ?? "{}").realistic.receiveRate).toBe(0);
    expect(screen.getByRole("button", { name: /Voltar ao padrão/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Voltar ao padrão/ }));
    expect(screen.getByLabelText("Recebe (%)")).toHaveValue(95);
  });

  it("sem saldo negativo, não há alerta", async () => {
    m.open.mockResolvedValue([{ id: "a", type: "income", status: "pending", amount: 1000, dueDate: "2026-09-28" }]);
    render(<CashFlowPage />);
    await screen.findByText("Em 1 carteira");
    expect(screen.queryByText(/fica negativo/)).toBeNull();
  });

  it("sem o financeiro no plano, mostra o upgrade e não busca", () => {
    m.plan = { hasFinancial: false, isLoading: false };
    render(<CashFlowPage />);
    expect(screen.getByText("upgrade Fluxo de caixa")).toBeInTheDocument();
    expect(m.open).not.toHaveBeenCalled();
  });
});
