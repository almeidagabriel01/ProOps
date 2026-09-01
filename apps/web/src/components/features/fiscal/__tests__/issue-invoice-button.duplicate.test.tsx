// @vitest-environment jsdom
/**
 * Emitir duas vezes a mesma proposta gera DOIS documentos fiscais válidos: a
 * `ref` enviada ao provedor é nova a cada chamada, e nada consultava as notas
 * já existentes. O aviso avisa — não bloqueia, porque reemitir é legítimo.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { previewFromProposal, issueFromProposal } = vi.hoisted(() => ({
  previewFromProposal: vi.fn(),
  issueFromProposal: vi.fn(async () => ({ invoices: [{ id: "i1" }] })),
}));

vi.mock("@/services/fiscal-service", () => ({
  FiscalService: { previewFromProposal, issueFromProposal },
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    data?: unknown;
  },
  callApi: vi.fn(),
}));

import { IssueInvoiceButton } from "../issue-invoice-button";

const SEM_NOTA = { canIssue: true, gaps: [], documentos: [], jaEmitidas: [] };

beforeEach(() => {
  vi.clearAllMocks();
  previewFromProposal.mockResolvedValue(SEM_NOTA);
});

async function clicarEmitir() {
  render(<IssueInvoiceButton source="proposal" sourceId="p1" />);
  await userEvent.click(screen.getByRole("button", { name: /Emitir NF/i }));
}

describe("IssueInvoiceButton — duplicidade", () => {
  it("emite direto quando não há nota anterior", async () => {
    await clicarEmitir();

    expect(issueFromProposal).toHaveBeenCalledWith("p1");
    expect(screen.queryByText("Esta proposta já tem nota")).toBeNull();
  });

  it("avisa antes de duplicar uma nota autorizada", async () => {
    previewFromProposal.mockResolvedValue({
      ...SEM_NOTA,
      jaEmitidas: [
        { id: "i1", type: "nfe", status: "authorized", numero: "12", serie: "1" },
      ],
    });

    await clicarEmitir();

    expect(screen.getByText("Esta proposta já tem nota")).toBeInTheDocument();
    expect(screen.getByText(/nº 12/)).toBeInTheDocument();
    // Avisou e parou — nada foi emitido ainda.
    expect(issueFromProposal).not.toHaveBeenCalled();
  });

  it("avisa também sobre nota em processamento", async () => {
    previewFromProposal.mockResolvedValue({
      ...SEM_NOTA,
      jaEmitidas: [{ id: "i1", type: "nfse", status: "processing" }],
    });

    await clicarEmitir();

    expect(screen.getByText("Processando")).toBeInTheDocument();
    expect(issueFromProposal).not.toHaveBeenCalled();
  });

  it("emite quando o usuário confirma a duplicata", async () => {
    previewFromProposal.mockResolvedValue({
      ...SEM_NOTA,
      jaEmitidas: [{ id: "i1", type: "nfe", status: "authorized" }],
    });

    await clicarEmitir();
    await userEvent.click(screen.getByRole("button", { name: "Emitir mesmo assim" }));

    expect(issueFromProposal).toHaveBeenCalledWith("p1");
  });

  it("segura o aviso aberto enquanto emite, com o loader no botão clicado", async () => {
    // Fechar no clique jogava o estado de carregando para o botão da linha,
    // longe de onde a pessoa clicou — parecia que nada tinha acontecido.
    let liberar: (v: { invoices: { id: string }[] }) => void = () => {};
    issueFromProposal.mockImplementation(
      () => new Promise((resolve) => (liberar = resolve)),
    );
    previewFromProposal.mockResolvedValue({
      ...SEM_NOTA,
      jaEmitidas: [{ id: "i1", type: "nfe", status: "authorized" }],
    });

    await clicarEmitir();
    await userEvent.click(screen.getByRole("button", { name: "Emitir mesmo assim" }));

    // Ainda emitindo: o diálogo continua na tela e os dois botões travados.
    expect(screen.getByText("Esta proposta já tem nota")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Emitir mesmo assim/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    await act(async () => {
      liberar({ invoices: [{ id: "i1" }] });
    });

    await waitFor(() =>
      expect(screen.queryByText("Esta proposta já tem nota")).toBeNull(),
    );
  });

  it("cancelar no aviso não emite nada", async () => {
    previewFromProposal.mockResolvedValue({
      ...SEM_NOTA,
      jaEmitidas: [{ id: "i1", type: "nfe", status: "authorized" }],
    });

    await clicarEmitir();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(issueFromProposal).not.toHaveBeenCalled();
  });

  it("emite mesmo se a checagem falhar — ela é auxiliar", async () => {
    // Bloquear a emissão por causa de uma consulta com erro seria trocar um
    // risco de duplicata por um de não faturar.
    previewFromProposal.mockRejectedValue(new Error("rede"));

    await clicarEmitir();

    expect(issueFromProposal).toHaveBeenCalledWith("p1");
  });
});
