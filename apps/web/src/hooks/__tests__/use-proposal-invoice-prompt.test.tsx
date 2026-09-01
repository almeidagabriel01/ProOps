// @vitest-environment jsdom
/**
 * Quando o convite pós-aprovação aparece — e, principalmente, quando não.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// `vi.mock` é içado para o topo do arquivo, então a fábrica não enxerga
// variáveis de módulo — `vi.hoisted` sobe as definições junto.
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
// `api-client` inicializa o Firebase no import — em jsdom isso estoura com
// `auth/invalid-api-key`, e o hook só precisa da classe de erro.
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    data?: unknown;
  },
  callApi: vi.fn(),
}));

import { useProposalInvoicePrompt } from "../use-proposal-invoice-prompt";

const PODE_EMITIR = {
  canIssue: true,
  gaps: [],
  documentos: [{ type: "nfe", valorTotal: 100 }],
  jaEmitidas: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  previewFromProposal.mockResolvedValue(PODE_EMITIR);
});

async function dispararConvite(proposalId = "p1") {
  const { result } = renderHook(() => useProposalInvoicePrompt());
  await act(async () => {
    await result.current.promptAfterApproval(proposalId, "Casa Silva");
  });
  return result;
}

describe("useProposalInvoicePrompt", () => {
  it("convida quando a nota pode sair", async () => {
    const result = await dispararConvite();

    expect(result.current.prompt).toMatchObject({
      proposalId: "p1",
      proposalTitle: "Casa Silva",
    });
  });

  it("não convida quando faltam dados fiscais", async () => {
    // Convidar e cair numa checklist transformaria o atalho em armadilha.
    previewFromProposal.mockResolvedValue({
      canIssue: false,
      reason: "FISCAL_INCOMPLETO",
      gaps: [{ scope: "produto", field: "ncm", message: "Informe o NCM" }],
      documentos: [],
      jaEmitidas: [],
    });

    const result = await dispararConvite();

    expect(result.current.prompt).toBeNull();
  });

  it("não convida antes da primeira nota autorizada", async () => {
    previewFromProposal.mockResolvedValue({
      canIssue: false,
      reason: "FISCAL_NAO_PRONTO",
      gaps: [],
      documentos: [],
      jaEmitidas: [],
    });

    expect((await dispararConvite()).current.prompt).toBeNull();
  });

  it("não convida quando a proposta já foi faturada", async () => {
    // Seria um convite a duplicar documento fiscal.
    previewFromProposal.mockResolvedValue({
      ...PODE_EMITIR,
      jaEmitidas: [{ id: "i1", type: "nfe", status: "authorized" }],
    });

    expect((await dispararConvite()).current.prompt).toBeNull();
  });

  it("não convida — nem quebra — se a consulta falhar", async () => {
    // A aprovação já aconteceu; uma consulta com erro não pode desfazê-la.
    previewFromProposal.mockRejectedValue(new Error("rede"));

    expect((await dispararConvite()).current.prompt).toBeNull();
  });

  it("emite ao confirmar e fecha o convite", async () => {
    const result = await dispararConvite();

    await act(async () => {
      await result.current.confirm();
    });

    expect(issueFromProposal).toHaveBeenCalledWith("p1");
    await waitFor(() => expect(result.current.prompt).toBeNull());
  });

  it("recusar não emite nada", async () => {
    const result = await dispararConvite();

    act(() => result.current.dismiss());

    expect(issueFromProposal).not.toHaveBeenCalled();
    expect(result.current.prompt).toBeNull();
  });
});
