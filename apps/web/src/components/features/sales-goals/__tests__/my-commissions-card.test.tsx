// @vitest-environment jsdom
/**
 * "Minhas comissões" no Dashboard: aparece para quem é vendedor ou arquiteto
 * ligado a um contato e tem comissão no mês, e some em todo o resto (sem
 * vínculo, sem comissão, sem o plano, conta de demonstração, falha da API).
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({
  plan: { hasSalesGoals: true, isLoading: false },
  perms: { isDemo: false },
  myCommissions: vi.fn(),
}));

vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => m.perms }));
vi.mock("@/services/sales-goals-service", () => ({
  SalesGoalsService: { myCommissions: (...a: unknown[]) => m.myCommissions(...a) },
}));

import { MyCommissionsCard } from "../my-commissions-card";

const entry = (id: string, extra: Record<string, unknown> = {}) => ({
  transactionId: id,
  amount: 100,
  dueDate: "2026-10-15",
  status: "pending",
  description: "Comissão Ana: Casa Alphaville",
  installmentNumber: null,
  installmentCount: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.plan = { hasSalesGoals: true, isLoading: false };
  m.perms = { isDemo: false };
});

describe("Minhas comissões", () => {
  it("vendedor ligado ve a receber, recebido e as comissoes do mes", async () => {
    m.myCommissions.mockResolvedValue({
      month: "2026-10",
      linked: true,
      aPagar: 300,
      pago: 200,
      total: 500,
      partners: [
        {
          contactId: "c1",
          contactName: "Ana",
          role: "vendedor",
          entries: [
            entry("1", { amount: 300, installmentNumber: 2, installmentCount: 4 }),
            entry("2", { amount: 200, status: "paid", dueDate: "2026-10-05" }),
          ],
        },
      ],
    });
    render(<MyCommissionsCard month="2026-10" />);
    expect(await screen.findByText(/Minhas comissões de/)).toBeInTheDocument();
    expect(screen.getByText("A receber").nextSibling).toHaveTextContent("300,00");
    expect(screen.getByText("Recebido").nextSibling).toHaveTextContent("200,00");
    expect(screen.getByText(/\(2\/4\)/)).toBeInTheDocument();
    expect(screen.getByText("Pago")).toBeInTheDocument();
    expect(m.myCommissions).toHaveBeenCalledWith("2026-10");
  });

  it("mostra quatro e resume o resto", async () => {
    m.myCommissions.mockResolvedValue({
      month: "2026-10",
      linked: true,
      aPagar: 600,
      pago: 0,
      total: 600,
      partners: [
        {
          contactId: "c1",
          contactName: "Ana",
          role: "arquiteto",
          entries: Array.from({ length: 6 }, (_, i) => entry(String(i))),
        },
      ],
    });
    render(<MyCommissionsCard month="2026-10" />);
    expect(await screen.findByText("e mais 2 comissões no mês")).toBeInTheDocument();
  });

  it("sem contato ligado, nada aparece", async () => {
    m.myCommissions.mockResolvedValue({ month: "2026-10", linked: false, aPagar: 0, pago: 0, total: 0, partners: [] });
    const { container } = render(<MyCommissionsCard month="2026-10" />);
    await waitFor(() => expect(m.myCommissions).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("ligado, mas sem comissao no mes, nada aparece", async () => {
    m.myCommissions.mockResolvedValue({ month: "2026-10", linked: true, aPagar: 0, pago: 0, total: 0, partners: [] });
    const { container } = render(<MyCommissionsCard month="2026-10" />);
    await waitFor(() => expect(m.myCommissions).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("sem o plano de metas nem chama a API", () => {
    m.plan = { hasSalesGoals: false, isLoading: false };
    const { container } = render(<MyCommissionsCard month="2026-10" />);
    expect(container).toBeEmptyDOMElement();
    expect(m.myCommissions).not.toHaveBeenCalled();
  });

  it("conta de demonstracao nem chama a API", () => {
    m.perms = { isDemo: true };
    const { container } = render(<MyCommissionsCard month="2026-10" />);
    expect(container).toBeEmptyDOMElement();
    expect(m.myCommissions).not.toHaveBeenCalled();
  });

  it("falha da API esconde o card sem quebrar o Dashboard", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    m.myCommissions.mockRejectedValue(new Error("offline"));
    const { container } = render(<MyCommissionsCard month="2026-10" />);
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    warn.mockRestore();
  });
});
