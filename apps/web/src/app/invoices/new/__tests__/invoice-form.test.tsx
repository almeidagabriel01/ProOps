// @vitest-environment jsdom
/**
 * A página de emissão: nota avulsa (remessa, devolução) e a revisão da nota
 * da proposta. A regra da nota é do backend (prévia); aqui se afirma o que a
 * tela manda, o que ela mostra da prévia e quando deixa enviar.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  listNaturezas: vi.fn(),
  previewManual: vi.fn(),
  previewFromProposalEdited: vi.fn(),
  issueManual: vi.fn(),
  issueFromProposal: vi.fn(),
  getProducts: vi.fn(async () => []),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push, back: m.back }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/services/fiscal-service", () => ({
  FiscalService: {
    listNaturezas: m.listNaturezas,
    previewManual: m.previewManual,
    previewFromProposalEdited: m.previewFromProposalEdited,
    issueManual: m.issueManual,
    issueFromProposal: m.issueFromProposal,
  },
}));
vi.mock("@/services/product-service", () => ({ ProductService: { getProducts: m.getProducts } }));
vi.mock("@/services/received-invoice-service", () => ({ ReceivedInvoiceService: { list: vi.fn() } }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => ({ hasFiscalReceiving: false }) }));
vi.mock("@/lib/toast", () => ({
  toast: Object.assign(vi.fn(), { success: m.toastSuccess, error: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    data?: unknown;
  },
  callApi: vi.fn(),
}));
// O seletor de contato real busca no Firestore; aqui basta escolher um.
vi.mock("@/components/features/client-select", () => ({
  ClientSelect: ({ onChange }: { onChange: (d: Record<string, unknown>) => void }) => (
    <button type="button" onClick={() => onChange({ clientId: "frahm", clientName: "Audiofrahm", isNew: false })}>
      Escolher Audiofrahm
    </button>
  ),
}));

import { InvoiceForm } from "../_components/invoice-form";

const NATUREZAS = [
  {
    id: "venda_mercadoria_terceiros",
    descricao: "Venda de mercadoria adquirida de terceiros",
    cfopDentroEstado: "5102",
    cfopForaEstado: "6102",
    tributada: true,
    finalidade: "normal",
    referencia: "nao_se_aplica",
  },
  {
    id: "remessa_conserto",
    descricao: "Remessa para conserto ou reparo",
    cfopDentroEstado: "5915",
    cfopForaEstado: "6915",
    tributada: false,
    finalidade: "normal",
    referencia: "nao_se_aplica",
  },
  {
    id: "devolucao_compra",
    descricao: "Devolução de compra para comercialização",
    cfopDentroEstado: "5202",
    cfopForaEstado: "6202",
    tributada: false,
    finalidade: "devolucao",
    referencia: "obrigatoria",
  },
];

function nfeView(overrides: Record<string, unknown> = {}) {
  return {
    naturezaOperacao: "Remessa para conserto ou reparo",
    finalidade: "normal",
    observacoes: "IPI destacado conforme pedido",
    notasReferenciadas: [],
    valorProdutos: 2090,
    valorIpi: 104.5,
    valorTotal: 2194.5,
    linhas: [
      {
        productId: "amp",
        descricao: "Amplificador",
        ncm: "85437019",
        cfop: "5915",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 2090,
        valorTotal: 2090,
        situacaoTributaria: "900",
        ipi: { cst: "50", aliquota: 5 },
        ipiValor: 104.5,
      },
    ],
    ...overrides,
  };
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    canIssue: true,
    gaps: [],
    documentos: [{ type: "nfe", valorTotal: 2194.5, nfe: nfeView() }],
    jaEmitidas: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  m.listNaturezas.mockResolvedValue({ naturezas: NATUREZAS });
  m.previewManual.mockResolvedValue(preview());
  m.previewFromProposalEdited.mockResolvedValue(preview());
  m.issueManual.mockResolvedValue({ invoices: [{ id: "n1" }] });
  m.issueFromProposal.mockResolvedValue({ invoices: [{ id: "n1" }] });
});

async function flushPreview() {
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
}

describe("nota avulsa", () => {
  it("nasce como remessa para conserto e mostra o CFOP da operação", async () => {
    render(<InvoiceForm />);
    expect(await screen.findByText(/CFOP 5915 dentro do estado, 6915 para outro estado/)).toBeInTheDocument();
    expect(screen.getByText(/Sem a tributação da venda/)).toBeInTheDocument();
  });

  it("sem destinatário não há prévia nem envio", async () => {
    render(<InvoiceForm />);
    await flushPreview();
    expect(m.previewManual).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Emitir nota" })).toBeDisabled();
  });

  it("com o destinatário pede a prévia e mostra o padrão do contato", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InvoiceForm />);
    await user.click(await screen.findByRole("button", { name: "Escolher Audiofrahm" }));
    await flushPreview();

    expect(m.previewManual).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "frahm", naturezaOperacao: "remessa_conserto" }),
    );
    // A observação do contato vem da prévia, e o IPI dele aparece na linha.
    await waitFor(() =>
      expect(screen.getByLabelText("Observações")).toHaveValue("IPI destacado conforme pedido"),
    );
    expect(screen.getByText("IPI 5%: R$ 104,50")).toBeInTheDocument();
  });

  it("emite e volta para a lista de notas", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InvoiceForm />);
    await user.click(await screen.findByRole("button", { name: "Escolher Audiofrahm" }));
    await flushPreview();
    await waitFor(() => expect(screen.getByRole("button", { name: "Emitir nota" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Emitir nota" }));

    expect(m.issueManual).toHaveBeenCalledWith(expect.objectContaining({ clientId: "frahm" }));
    await waitFor(() => expect(m.push).toHaveBeenCalledWith("/invoices"));
  });

  it("devolução pede a chave da nota devolvida e mostra o que falta", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    m.previewManual.mockResolvedValue(
      preview({
        canIssue: false,
        reason: "FISCAL_INCOMPLETO",
        gaps: [
          {
            scope: "nota",
            field: "notasReferenciadas",
            message: "Informe a chave de acesso da nota que está sendo devolvida.",
          },
        ],
      }),
    );
    render(<InvoiceForm />);
    await screen.findByText(/CFOP 5915/);
    fireEvent.change(screen.getByLabelText("Natureza da operação"), {
      target: { value: "devolucao_compra" },
    });
    await user.click(screen.getByRole("button", { name: "Escolher Audiofrahm" }));
    await flushPreview();

    expect(screen.getByLabelText("Chave da nota devolvida")).toBeInTheDocument();
    expect(await screen.findByText(/Informe a chave de acesso da nota/)).toBeInTheDocument();
    expect(screen.getByText("Nesta nota")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Emitir nota" })).toBeDisabled();
  });

  it("chave incompleta trava o envio antes da SEFAZ", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InvoiceForm />);
    await screen.findByText(/CFOP 5915/);
    fireEvent.change(screen.getByLabelText("Natureza da operação"), {
      target: { value: "devolucao_compra" },
    });
    await user.click(screen.getByRole("button", { name: "Escolher Audiofrahm" }));
    fireEvent.change(screen.getByLabelText("Chave da nota devolvida"), { target: { value: "4226" } });
    await flushPreview();

    expect(screen.getByText(/A chave de acesso tem 44 dígitos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Emitir nota" })).toBeDisabled();
  });
});

describe("revisão da nota da proposta", () => {
  it("mostra os itens da venda e manda só o IPI mexido", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InvoiceForm proposalId="p1" />);
    await flushPreview();

    expect(m.previewFromProposalEdited).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ naturezaOperacao: "venda_mercadoria_terceiros" }),
    );
    expect(await screen.findByText("Amplificador")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /IPI 5%/ }));
    fireEvent.change(screen.getByLabelText("Situação do IPI (CST)"), { target: { value: "" } });
    await flushPreview();
    await waitFor(() => expect(screen.getByRole("button", { name: "Emitir nota" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Emitir nota" }));

    expect(m.issueFromProposal).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        nfe: expect.objectContaining({ linhas: [{ index: 0, productId: "amp", ipi: null }] }),
      }),
    );
  });

  it("proposta já faturada avisa e o botão diz o que vai acontecer", async () => {
    m.previewFromProposalEdited.mockResolvedValue(
      preview({ jaEmitidas: [{ id: "n0", type: "nfe", status: "authorized", numero: "12" }] }),
    );
    render(<InvoiceForm proposalId="p1" />);
    await flushPreview();

    expect(await screen.findByText("Esta proposta já tem nota")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Emitir mesmo assim" })).toBeInTheDocument();
  });

  it("venda mista avisa que a NFS-e sai junto", async () => {
    m.previewFromProposalEdited.mockResolvedValue(
      preview({
        documentos: [
          { type: "nfe", valorTotal: 2194.5, nfe: nfeView() },
          { type: "nfse", valorTotal: 500 },
        ],
      }),
    );
    render(<InvoiceForm proposalId="p1" />);
    await flushPreview();

    expect(await screen.findByText(/Junto sai a NFS-e da mão de obra/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Emitir as 2 notas" })).toBeInTheDocument();
  });
});
