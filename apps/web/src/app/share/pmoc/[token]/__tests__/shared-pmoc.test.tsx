// @vitest-environment jsdom
/**
 * A página pública do PMOC: o plano por padrão, o relatório com o período, e
 * no modo de impressão só o documento pedido, com o marcador que o Chromium
 * espera para imprimir.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PmocView } from "@/services/pmoc-service";

let search = new URLSearchParams();
const m = vi.hoisted(() => ({ view: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "tok123" }),
  useSearchParams: () => search,
}));
vi.mock("@/services/pmoc-service", () => ({ PmocService: { view: m.view } }));

import SharedPmocPage from "../page";

const VIEW: PmocView = {
  tenant: { name: "Frio Bom", logoUrl: null, primaryColor: null },
  contract: { code: "CT-0001", title: "PMOC", status: "active", startDate: "2026-01-05", intervalMonths: 1 },
  client: { name: "Clínica", address: "Rua A, 1" },
  building: { name: "Clínica Centro", address: "Rua A, 1", occupants: 40, climatizedArea: 320, use: "Clínica" },
  responsible: {
    name: "Carla Mendes",
    profession: "Engenheira mecânica",
    council: "CREA",
    registryNumber: "SP-1",
    artNumber: "ART-9",
    artValidUntil: "2027-01-01",
    artUrl: "https://files/art.pdf",
  },
  equipment: [{ name: "Split da recepção", type: "Split hi-wall", brand: null, model: null, capacity: null, location: null }],
  groups: [{ label: "Split", items: [{ text: "Limpar os filtros", frequency: "Mensal" }] }],
  period: { from: "2025-10-04", to: "2026-10-03" },
  visits: [
    {
      code: "OS-0001",
      day: "2026-02-10",
      status: "completed",
      technicianName: "Téo",
      checklist: [{ text: "Split: Limpar os filtros", done: true }],
      doneCount: 1,
      report: null,
      signedBy: "Ana",
    },
  ],
  executions: [
    { id: "split_filtros", category: "Split", text: "Limpar os filtros", frequency: "Mensal", timesDone: 1, lastDoneOn: "2026-02-10" },
    { id: "split_gas", category: "Split", text: "Testar vazamentos", frequency: "Semestral", timesDone: 0, lastDoneOn: null },
  ],
};

beforeEach(() => {
  search = new URLSearchParams();
  m.view.mockReset();
  m.view.mockResolvedValue(VIEW);
});

describe("no navegador", () => {
  it("abre no plano, com o responsável, os aparelhos e os itens", async () => {
    render(<SharedPmocPage />);
    expect(await screen.findByText("Clínica Centro")).toBeInTheDocument();
    expect(screen.getByText("Carla Mendes")).toBeInTheDocument();
    expect(screen.getByText("Split da recepção")).toBeInTheDocument();
    expect(screen.getByText("Limpar os filtros")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver a ART/ })).toHaveAttribute("href", "https://files/art.pdf");
    expect(screen.queryByText("OS-0001 · 10/02/2026")).toBeNull();
  });

  it("o relatório mostra as visitas, o item não feito e troca o período", async () => {
    render(<SharedPmocPage />);
    await screen.findByText("Clínica Centro");
    await userEvent.click(screen.getByRole("button", { name: "Relatório de execução" }));
    expect(screen.getByText("OS-0001 · 10/02/2026")).toBeInTheDocument();
    expect(screen.getByText("Não feito")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ano passado" }));
    await waitFor(() => expect(m.view).toHaveBeenLastCalledWith("tok123", expect.objectContaining({ to: expect.stringMatching(/-12-31$/) })));
  });

  it("link inválido mostra o aviso, sem o marcador de impressão", async () => {
    m.view.mockRejectedValue(new Error("404"));
    const { container } = render(<SharedPmocPage />);
    expect(await screen.findByText("Link indisponível")).toBeInTheDocument();
    expect(container.querySelector('[data-pdf-pmoc-ready="1"]')).toBeNull();
  });
});

describe("impressão", () => {
  it("relatório: só ele, no período pedido, sem a troca de documento e com o marcador", async () => {
    search = new URLSearchParams({ print: "1", kind: "report", from: "2026-01-01", to: "2026-06-30" });
    const { container } = render(<SharedPmocPage />);
    expect(await screen.findByText("OS-0001 · 10/02/2026")).toBeInTheDocument();
    expect(m.view).toHaveBeenCalledWith("tok123", { from: "2026-01-01", to: "2026-06-30" });
    expect(screen.queryByRole("button", { name: "Plano" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ano passado" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ver a ART/ })).toBeNull();
    expect(container.querySelector('[data-pdf-pmoc-ready="1"]')).not.toBeNull();
  });

  it("plano: sem as visitas", async () => {
    search = new URLSearchParams({ print: "1", kind: "plan" });
    const { container } = render(<SharedPmocPage />);
    expect(await screen.findByText("Limpar os filtros")).toBeInTheDocument();
    expect(screen.queryByText("OS-0001 · 10/02/2026")).toBeNull();
    expect(container.querySelector('[data-pdf-pmoc-ready="1"]')).not.toBeNull();
  });
});
