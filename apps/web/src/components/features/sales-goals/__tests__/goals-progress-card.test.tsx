// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const m = vi.hoisted(() => ({
  plan: { hasSalesGoals: true, isLoading: false },
  perms: { isDemo: false, isMaster: true },
  progress: vi.fn(),
}));

vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/providers/permissions-provider", () => ({ usePermissions: () => m.perms }));
vi.mock("@/services/sales-goals-service", () => ({
  SalesGoalsService: { progress: (...a: unknown[]) => m.progress(...a) },
}));

import { GoalsProgressCard, goalPercent } from "../goals-progress-card";

beforeEach(() => {
  vi.clearAllMocks();
  m.plan = { hasSalesGoals: true, isLoading: false };
  m.perms = { isDemo: false, isMaster: true };
});

describe("metas no Dashboard", () => {
  it("o dono vê a empresa, cada pessoa e o que ficou sem responsável", async () => {
    m.progress.mockResolvedValue({
      month: "2026-09",
      scope: "company",
      companyTarget: 50000,
      companyAchieved: 25000,
      companyCount: 3,
      people: [
        { id: "ana", name: "Ana", target: 20000, achieved: 22000, count: 2 },
        { id: "beto", name: "Beto", target: 15000, achieved: 1000, count: 1 },
      ],
      unassignedAchieved: 2000,
    });
    render(<GoalsProgressCard month="2026-09" />);

    expect(await screen.findByText("Empresa")).toBeInTheDocument();
    expect(m.progress).toHaveBeenCalledWith("2026-09");
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    // Meta batida passa de 100%.
    expect(screen.getByText("110%")).toBeInTheDocument();
    expect(screen.getByText(/em propostas sem responsável pela venda/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar metas" })).toHaveAttribute("href", "/goals");
  });

  it("o membro vê só o próprio número", async () => {
    m.perms = { isDemo: false, isMaster: false };
    m.progress.mockResolvedValue({ month: "2026-09", scope: "mine", target: 10000, achieved: 4000, count: 1 });
    render(<GoalsProgressCard month="2026-09" />);
    expect(await screen.findByText("Você")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.queryByText("Empresa")).toBeNull();
    expect(screen.queryByRole("link", { name: /metas/ })).toBeNull();
  });

  it("membro sem meta e sem venda no mês: o card some", async () => {
    m.perms = { isDemo: false, isMaster: false };
    m.progress.mockResolvedValue({ month: "2026-09", scope: "mine", target: null, achieved: 0, count: 0 });
    const { container } = render(<GoalsProgressCard month="2026-09" />);
    await vi.waitFor(() => expect(m.progress).toHaveBeenCalled());
    await vi.waitFor(() => expect(container.querySelector(".animate-pulse")).toBeNull());
    expect(screen.queryByText("Você")).toBeNull();
  });

  it("falha ao carregar mostra o aviso em vez de sumir (dono e membro)", async () => {
    m.progress.mockRejectedValue(new Error("FAILED_PRECONDITION"));
    const { unmount } = render(<GoalsProgressCard month="2026-09" />);
    expect(await screen.findByText(/Não foi possível carregar as metas/)).toBeInTheDocument();
    unmount();

    m.perms = { isDemo: false, isMaster: false };
    render(<GoalsProgressCard month="2026-09" />);
    expect(await screen.findByText(/Não foi possível carregar as metas/)).toBeInTheDocument();
  });

  it("sem o plano, nem chama a API", () => {
    m.plan = { hasSalesGoals: false, isLoading: false };
    const { container } = render(<GoalsProgressCard month="2026-09" />);
    expect(container).toBeEmptyDOMElement();
    expect(m.progress).not.toHaveBeenCalled();
  });

  it("conta de demonstração mostra um exemplo rotulado, sem chamar a API", async () => {
    m.perms = { isDemo: true, isMaster: false };
    render(<GoalsProgressCard month="2026-09" />);
    expect(await screen.findByText("Exemplo da conta de demonstração.")).toBeInTheDocument();
    expect(m.progress).not.toHaveBeenCalled();
  });
});

it("percentual da meta", () => {
  expect(goalPercent(5000, 10000)).toBe(50);
  expect(goalPercent(5000, null)).toBeNull();
  expect(goalPercent(5000, 0)).toBeNull();
});
