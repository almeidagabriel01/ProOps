// @vitest-environment jsdom
/**
 * Aprovar uma proposta abria até três janelas seguidas (nota, obra, contrato),
 * cada uma travando a tela. Agora é uma janela só, "Proposta aprovada", com
 * cada próximo passo como linha opcional e um "Fechar" que dispensa tudo.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  previewFromProposal: vi.fn(),
  issueFromProposal: vi.fn(async () => ({ invoices: [{ id: "i1" }] })),
  createProject: vi.fn(async () => ({ projectId: "obra1" })),
  push: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/lib/toast", () => ({ toast: Object.assign(vi.fn(), { success: m.toastSuccess, error: vi.fn() }) }));
vi.mock("@/services/projects-service", () => ({ ProjectsService: { create: m.createProject } }));
vi.mock("@/services/fiscal-service", () => ({
  FiscalService: { previewFromProposal: m.previewFromProposal, issueFromProposal: m.issueFromProposal },
}));
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    data?: unknown;
  },
  callApi: vi.fn(),
}));

import { ApprovalNextStepsHost } from "../approval-next-steps-host";
import { useProposalInvoicePrompt } from "@/hooks/use-proposal-invoice-prompt";
import { announceProjectOnApproval, resetProjectApprovalQueue } from "@/lib/project-on-approval";
import { INVOICE_WAIT_MS, expectInvoiceStep, getApprovalEntries, isEntryReady } from "@/lib/approval-next-steps";

const PODE_EMITIR = { canIssue: true, gaps: [], documentos: [{ type: "nfe", valorTotal: 100 }], jaEmitidas: [] };

function invoiceHook() {
  return renderHook(() => useProposalInvoicePrompt()).result.current;
}

/** Simula a lista: consulta a nota em paralelo, aprova, anuncia obra e contrato, decide a nota. */
async function approve(opts: { result?: Parameters<typeof announceProjectOnApproval>[0]; preview?: unknown }) {
  m.previewFromProposal.mockResolvedValue(opts.preview ?? PODE_EMITIR);
  const hook = invoiceHook();
  let pending!: Promise<unknown>;
  act(() => {
    pending = hook.startPreview("p1");
  });
  act(() => announceProjectOnApproval(opts.result ?? {}, { id: "p1", title: "Casa" }));
  await act(async () => {
    await hook.promptAfterApproval("p1", "Casa", pending as never);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetProjectApprovalQueue();
});

describe("uma janela só para os próximos passos", () => {
  it("nota, obra e contrato na mesma janela", async () => {
    render(<ApprovalNextStepsHost />);
    await approve({ result: { projectSuggested: true, contractCreated: "ct1" } });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("Proposta aprovada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Emitir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar obra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir o contrato" })).toBeInTheDocument();
  });

  it("espera a consulta da nota antes de abrir, para não abrir sem ela", async () => {
    render(<ApprovalNextStepsHost />);
    let resolvePreview!: (v: unknown) => void;
    m.previewFromProposal.mockReturnValue(new Promise((r) => (resolvePreview = r)));
    const hook = invoiceHook();
    let pending!: Promise<unknown>;
    act(() => {
      pending = hook.startPreview("p1");
    });
    act(() => announceProjectOnApproval({ projectSuggested: true }, { id: "p1", title: "Casa" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    const decided = hook.promptAfterApproval("p1", "Casa", pending as never);
    await act(async () => {
      resolvePreview(PODE_EMITIR);
      await decided;
    });
    expect(screen.getByRole("button", { name: "Emitir" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar obra" })).toBeInTheDocument();
  });

  it("consulta travada: depois do prazo a janela abre sem a nota", () => {
    expectInvoiceStep("p9", 1_000);
    announceProjectOnApproval({ projectSuggested: true }, { id: "p9", title: "Loja" });
    const entry = getApprovalEntries().find((e) => e.proposalId === "p9")!;
    expect(isEntryReady(entry, 1_000 + INVOICE_WAIT_MS - 1)).toBe(false);
    expect(isEntryReady(entry, 1_000 + INVOICE_WAIT_MS)).toBe(true);
  });

  it("Fechar dispensa tudo sem criar nada", async () => {
    render(<ApprovalNextStepsHost />);
    await approve({ result: { projectSuggested: true, contractCreated: "ct1" } });
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(m.createProject).not.toHaveBeenCalled();
    expect(m.issueFromProposal).not.toHaveBeenCalled();
  });

  it("aprovação que falhou não deixa nada para mostrar", () => {
    render(<ApprovalNextStepsHost />);
    const hook = invoiceHook();
    act(() => {
      void hook.startPreview("p1");
    });
    act(() => hook.dismiss());
    expect(getApprovalEntries()).toEqual([]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("o formulário anuncia e troca de página: a janela aparece quando o host monta", () => {
    announceProjectOnApproval({ contractCreated: "ct1" }, { id: "p2", title: "Loja" });
    render(<ApprovalNextStepsHost />);
    expect(screen.getByText(/"Loja" foi aprovada/)).toBeInTheDocument();
  });
});

describe("nota fiscal", () => {
  it("emitir marca a linha como enviada e a janela continua com os outros passos", async () => {
    render(<ApprovalNextStepsHost />);
    await approve({ result: { projectSuggested: true } });
    await userEvent.click(screen.getByRole("button", { name: "Emitir" }));
    expect(m.issueFromProposal).toHaveBeenCalledWith("p1");
    expect(await screen.findByText(/Enviada\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar obra" })).toBeInTheDocument();
  });

  it.each([
    ["faltam dados fiscais", { canIssue: false, gaps: [{ field: "cnpj" }], documentos: [], jaEmitidas: [], reason: "FISCAL_INCOMPLETO" }],
    ["a proposta já foi faturada", { ...PODE_EMITIR, jaEmitidas: [{ id: "n1" }] }],
  ])("não oferece quando %s", async (_label, preview) => {
    render(<ApprovalNextStepsHost />);
    await approve({ result: { projectSuggested: true }, preview });
    expect(screen.queryByRole("button", { name: "Emitir" })).toBeNull();
    expect(screen.getByRole("button", { name: "Criar obra" })).toBeInTheDocument();
  });

  it("consulta que falha não quebra nem oferece", async () => {
    render(<ApprovalNextStepsHost />);
    m.previewFromProposal.mockRejectedValue(new Error("rede"));
    const hook = invoiceHook();
    let pending!: Promise<unknown>;
    act(() => {
      pending = hook.startPreview("p1");
    });
    await act(async () => {
      await hook.promptAfterApproval("p1", "Casa", pending as never);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getApprovalEntries()).toEqual([]);
  });
});

describe("obra", () => {
  it("criada sozinha (modo sempre) e nada mais: aviso curto, sem janela", () => {
    render(<ApprovalNextStepsHost />);
    act(() => announceProjectOnApproval({ projectCreated: "obra9" }, { id: "p3", title: "Casa" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(m.toastSuccess).toHaveBeenCalledWith(
      "Projeto de instalação criado para acompanhar a obra.",
      expect.objectContaining({ button: expect.objectContaining({ title: "Abrir" }) }),
    );
  });

  it("criar a obra pela janela não sai da janela; abrir leva à obra", async () => {
    render(<ApprovalNextStepsHost />);
    act(() => announceProjectOnApproval({ projectSuggested: true, contractCreated: "ct1" }, { id: "p4", title: "Casa" }));
    await userEvent.click(screen.getByRole("button", { name: "Criar obra" }));
    expect(m.createProject).toHaveBeenCalledWith({ proposalId: "p4" });
    expect(await screen.findByText("Obra criada.")).toBeInTheDocument();
    expect(m.push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Abrir a obra" }));
    expect(m.push).toHaveBeenCalledWith("/projects/obra1");
  });

  it("aprovação sem obra nem contrato nem nota: nada aparece", () => {
    render(<ApprovalNextStepsHost />);
    act(() => announceProjectOnApproval({ projectSuggested: false, contractCreated: null }, { id: "p5" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(m.toastSuccess).not.toHaveBeenCalled();
  });
});

describe("contrato", () => {
  it("abrir o contrato leva à tela dele e fecha a janela", async () => {
    render(<ApprovalNextStepsHost />);
    act(() => announceProjectOnApproval({ contractCreated: "ct7" }, { id: "p6", title: "Loja" }));
    await userEvent.click(screen.getByRole("button", { name: "Abrir o contrato" }));
    expect(m.push).toHaveBeenCalledWith("/contracts/ct7");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
