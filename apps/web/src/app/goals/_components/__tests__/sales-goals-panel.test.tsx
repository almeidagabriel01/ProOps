// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  getConfig: vi.fn(),
  progress: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/month-key", () => ({
  currentMonthKey: () => "2026-09",
  shiftMonth: (month: string, delta: number) => (delta > 0 ? "2026-10" : "2026-08"),
  formatMonthLabel: (month: string) => (month === "2026-09" ? "Setembro de 2026" : month),
}));
vi.mock("@/services/sales-goals-service", () => ({
  SalesGoalsService: {
    getConfig: (...a: unknown[]) => m.getConfig(...a),
    progress: (...a: unknown[]) => m.progress(...a),
    save: (...a: unknown[]) => m.save(...a),
  },
}));

import { SalesGoalsPanel } from "../sales-goals-panel";

const CONFIG = {
  month: "2026-09",
  companyTarget: 50000,
  targets: { ana: 20000 },
  people: [
    { id: "ana", name: "Ana" },
    { id: "bruno", name: "Bruno" },
  ],
};

const PROGRESS = {
  month: "2026-09",
  scope: "company",
  companyTarget: 50000,
  companyAchieved: 25000,
  companyCount: 3,
  people: [
    { id: "ana", name: "Ana", target: 20000, achieved: 10000, count: 2 },
    { id: "bruno", name: "Bruno", target: null, achieved: 4000, count: 1 },
  ],
  unassignedAchieved: 11000,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.getConfig.mockResolvedValue(CONFIG);
  m.progress.mockResolvedValue(PROGRESS);
  m.save.mockImplementation(async (input: { companyTarget: number | null; targets: Record<string, number> }) => input);
});

describe("tela de metas de vendas", () => {
  it("mostra ao lado da meta quanto cada pessoa já vendeu", async () => {
    render(<SalesGoalsPanel header={<h1>Metas de vendas</h1>} />);

    const ana = (await screen.findByText("Ana")).closest("li")!;
    expect(within(ana).getByText(/10\.000/)).toBeInTheDocument();
    expect(within(ana).getByText("50%")).toBeInTheDocument();

    // Sem meta, o vendido aparece e a barra não.
    const bruno = screen.getByText("Bruno").closest("li")!;
    expect(within(bruno).getByText(/4\.000/)).toBeInTheDocument();
    expect(within(bruno).queryByRole("progressbar")).toBeNull();

    expect(screen.getByText(/25\.000/)).toBeInTheDocument();
    expect(screen.getByText(/em propostas sem responsável pela venda/)).toBeInTheDocument();
    expect(screen.getByText(/ainda não estão com ninguém da equipe/)).toBeInTheDocument();
  });

  it("a porcentagem segue a meta que está sendo digitada", async () => {
    render(<SalesGoalsPanel />);
    const input = await screen.findByLabelText("Bruno");
    // O campo lê dígitos em centavos pelo teclado; colar é o caminho que o
    // jsdom exercita. 800000 é R$ 8.000,00.
    await userEvent.click(input);
    await userEvent.paste("800000");
    const bruno = screen.getByText("Bruno").closest("li")!;
    expect(within(bruno).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("salva pelo botão do cabeçalho, só com as metas preenchidas", async () => {
    render(<SalesGoalsPanel />);
    await screen.findByText("Ana");
    await userEvent.click(screen.getByRole("button", { name: "Salvar metas" }));
    await waitFor(() =>
      expect(m.save).toHaveBeenCalledWith({ month: "2026-09", companyTarget: 50000, targets: { ana: 20000 } }),
    );
  });

  it("sem o vendido do mês, a tela continua servindo para definir as metas", async () => {
    m.progress.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<SalesGoalsPanel />);

    expect(await screen.findByLabelText("Ana")).toBeInTheDocument();
    expect(screen.queryByText(/25\.000/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("trocar de mês busca as metas e o vendido do mês novo", async () => {
    render(<SalesGoalsPanel />);
    await screen.findByText("Ana");
    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await waitFor(() => expect(m.getConfig).toHaveBeenLastCalledWith("2026-10"));
    expect(m.progress).toHaveBeenLastCalledWith("2026-10");
  });
});
