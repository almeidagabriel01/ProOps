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
  parseSourceXml: vi.fn(),
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
    parseSourceXml: m.parseSourceXml,
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
    referencia: "opcional",
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

const PIS_ZERADO = { cst: "99", baseCalculo: 0, aliquota: 0, valor: 0 };

function nfeView(overrides: Record<string, unknown> = {}) {
  return {
    icmsKind: "csosn",
    naturezaOperacao: "Remessa para conserto ou reparo",
    finalidade: "normal",
    observacoes: "IPI destacado conforme pedido",
    mensagensLegais: [],
    notasReferenciadas: [],
    valorProdutos: 2090,
    valorIpi: 104.5,
    baseIcms: 0,
    valorIcms: 0,
    valorCreditoIcms: 0,
    valorPis: 0,
    valorCofins: 0,
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
        icms: { kind: "csosn", situacao: "900" },
        pis: PIS_ZERADO,
        cofins: PIS_ZERADO,
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
    expect(screen.getByText(/ICMS CSOSN 900 · IPI: R\$ 104,50 · PIS\/COFINS 99/)).toBeInTheDocument();
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
  it("mostra os itens da venda e manda só o imposto mexido", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InvoiceForm proposalId="p1" />);
    await flushPreview();

    expect(m.previewFromProposalEdited).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ naturezaOperacao: "venda_mercadoria_terceiros" }),
    );
    expect(await screen.findByText("Amplificador")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Impostos/ }));
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

describe("impostos da linha (pedido da AWA)", () => {
  function preview101() {
    const linha = {
      ...nfeView().linhas[0],
      cfop: "5102",
      icms: { kind: "csosn", situacao: "101", aliquotaCredito: 1.25, valorCredito: 26.13 },
      ipi: undefined,
      ipiValor: 0,
    };
    const mensagem =
      "Permite o aproveitamento do crédito de ICMS no valor de R$ 26,13, correspondente à alíquota de 1,25%, nos termos do art. 23 da LC 123/2006.";
    return preview({
      documentos: [
        {
          type: "nfe",
          valorTotal: 2090,
          nfe: nfeView({ linhas: [linha], valorIpi: 0, valorTotal: 2090, valorCreditoIcms: 26.13, mensagensLegais: [mensagem] }),
        },
      ],
    });
  }

  it("cliente 101: mostra o crédito e a frase do art. 23, e deixa trocar o CSOSN na linha", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    m.previewFromProposalEdited.mockResolvedValue(preview101());
    render(<InvoiceForm proposalId="p1" />);
    await flushPreview();

    expect(await screen.findByTestId("mensagens-legais")).toHaveTextContent("art. 23 da LC 123/2006");
    expect(screen.getByText("Crédito de ICMS")).toBeInTheDocument();
    expect(screen.getByText(/ICMS CSOSN 101, crédito de R\$ 26,13/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Impostos/ }));
    // O crédito vem das configurações: o campo começa com a alíquota aplicada.
    expect(screen.getByLabelText("Crédito do Simples (%)")).toHaveValue("1,25");
    fireEvent.change(screen.getByLabelText("Situação do ICMS (CSOSN)"), { target: { value: "102" } });
    expect(screen.queryByLabelText("Crédito do Simples (%)")).not.toBeInTheDocument();
    await flushPreview();
    await waitFor(() => expect(screen.getByRole("button", { name: "Emitir nota" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Emitir nota" }));

    expect(m.issueFromProposal).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({
        nfe: expect.objectContaining({ linhas: [{ index: 0, productId: "amp", icms: { situacao: "102" } }] }),
      }),
    );
  });

  it("CSOSN 900 aceita a base menor que o valor do produto, a alíquota e o PIS", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InvoiceForm />);
    await user.click(await screen.findByRole("button", { name: "Escolher Audiofrahm" }));
    await flushPreview();

    await user.click(await screen.findByRole("button", { name: /Impostos/ }));
    fireEvent.change(screen.getByLabelText("Base do ICMS"), { target: { value: "1500" } });
    fireEvent.change(screen.getByLabelText("Alíquota do ICMS (%)"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("CST do PIS"), { target: { value: "01" } });
    fireEvent.change(screen.getByLabelText("Alíquota do PIS (%)"), { target: { value: "0,65" } });
    await flushPreview();

    const body = m.previewManual.mock.calls.at(-1)?.[0] as { linhas: Array<Record<string, unknown>> };
    expect(body.linhas[0]).toMatchObject({
      icms: { situacao: "900", baseCalculo: 1500, aliquota: 12 },
      pis: { cst: "01", aliquota: 0.65 },
    });
    // O que não foi mexido (COFINS, IPI) segue o padrão do contato.
    expect(body.linhas[0]).not.toHaveProperty("cofins");
    expect(body.linhas[0]).not.toHaveProperty("ipi");
  });

  it("a quantidade digitada chega na prévia (o filtro do campo apagava os dígitos)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InvoiceForm />);
    await user.click(await screen.findByRole("button", { name: "Escolher Audiofrahm" }));
    const quantidade = screen.getByLabelText("Quantidade");
    await user.clear(quantidade);
    await user.type(quantidade, "3,5");
    expect(quantidade).toHaveValue("3,5");
    await flushPreview();

    const body = m.previewManual.mock.calls.at(-1)?.[0] as { linhas: Array<Record<string, unknown>> };
    expect(body.linhas[0].quantidade).toBe(3.5);
  });
});

describe("nota de origem (XML ou recebidas)", () => {
  const CHAVE = "42251027133259000167550010000123451000123450";

  beforeEach(() => {
    m.parseSourceXml.mockResolvedValue({
      chave: CHAVE,
      numero: "12345",
      emitente: { documento: "27133259000167", nome: "Audiofrahm Industria" },
      valorTotal: 10750,
      relacao: "recebida",
      itens: [
        {
          numero: 1,
          codigo: "AMP-5000",
          descricao: "Amplificador 70V",
          ncm: "85437019",
          cfop: "6101",
          unidade: "UN",
          quantidade: 5,
          valorUnitario: 2090,
          valorTotal: 10450,
          origem: 0,
        },
        {
          numero: 2,
          codigo: "CX-01",
          descricao: "Caixa de som",
          ncm: "85182100",
          cfop: "6102",
          unidade: "PC",
          quantidade: 2,
          valorUnitario: 150,
          valorTotal: 300,
        },
      ],
    });
  });

  it("remessa para conserto: a nota tem 5, mando 1, e a chave entra na referência", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<InvoiceForm />);
    await user.click(await screen.findByRole("button", { name: "Escolher Audiofrahm" }));
    await user.click(screen.getByRole("button", { name: "Trazer da nota de origem" }));

    const file = new File(["<nfeProc/>"], "nota.xml", { type: "text/xml" });
    fireEvent.change(screen.getByTestId("source-xml-input"), { target: { files: [file] } });

    expect(await screen.findByText("Amplificador 70V")).toBeInTheDocument();
    expect(m.parseSourceXml).toHaveBeenCalledWith("<nfeProc/>");
    await user.click(screen.getByRole("checkbox", { name: "Levar Caixa de som" }));
    const quantidade = screen.getByLabelText("Quantidade de Amplificador 70V");
    await user.clear(quantidade);
    await user.type(quantidade, "6");
    expect(screen.getByText("Entre 0 e 5.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usar 1 item" })).toBeDisabled();
    await user.clear(quantidade);
    await user.type(quantidade, "1");
    await user.click(screen.getByRole("button", { name: "Usar 1 item" }));

    expect(screen.getByLabelText("Chave da nota de origem (opcional)")).toHaveValue(CHAVE);
    await flushPreview();
    const body = m.previewManual.mock.calls.at(-1)?.[0] as {
      linhas: Array<Record<string, unknown>>;
      nfe: { notasReferenciadas: string[] };
    };
    // A linha em branco foi substituída pelo item da nota.
    expect(body.linhas).toEqual([
      expect.objectContaining({ codigo: "AMP-5000", descricao: "Amplificador 70V", ncm: "85437019", quantidade: 1, valorUnitario: 2090, origem: 0 }),
    ]);
    expect(body.nfe.notasReferenciadas).toEqual([CHAVE]);
  });

  it("XML recusado mostra o motivo do backend", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { ApiError } = await import("@/lib/api-client");
    const erro = Object.assign(new ApiError(400, "Bad Request"), {
      // O ApiError deste arquivo é o do mock, que não guarda o terceiro argumento.
      data: { message: "O arquivo não é o XML de uma NF-e." },
    });
    m.parseSourceXml.mockRejectedValue(erro);
    render(<InvoiceForm />);
    await screen.findByText(/CFOP 5915/);
    await user.click(screen.getByRole("button", { name: "Trazer da nota de origem" }));
    fireEvent.change(screen.getByTestId("source-xml-input"), {
      target: { files: [new File(["x"], "nfse.xml", { type: "text/xml" })] },
    });
    expect(await screen.findByText("O arquivo não é o XML de uma NF-e.")).toBeInTheDocument();
  });
});
