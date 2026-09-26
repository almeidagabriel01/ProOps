// @vitest-environment jsdom
/**
 * Ficha 360 do contato: cada aba segue a permissão da tela dela e o plano.
 * Um membro sem acesso ao financeiro não pode ver valores de lançamento pelo
 * contato.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  perms: {} as Record<string, { canView: boolean; canEdit: boolean }>,
  plan: { hasFinancial: true, hasFiscal: true },
  aba: null as string | null,
  getProposalsByClient: vi.fn(),
  getTransactionsByClient: vi.fn(),
  listInvoices: vi.fn(),
  listNotes: vi.fn(),
  createNote: vi.fn(),
}));

// O painel de tarefas tem teste próprio; aqui só importa que ele aparece.
vi.mock("@/components/features/tasks/tasks-panel", () => ({
  TasksPanel: () => <div data-testid="tasks-panel" />,
}));
// O botão do portal tem teste próprio; aqui só importa que ele está na ficha.
vi.mock("@/components/features/client-portal/client-portal-button", () => ({
  ClientPortalButton: () => <div data-testid="client-portal-button" />,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: (key: string) => (key === "aba" ? m.aba : null) }),
}));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: { id: "t1" } }) }));
vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/hooks/usePagePermission", () => ({
  usePagePermission: (page: string) => m.perms[page] ?? { canView: false, canEdit: false },
}));
vi.mock("@/services/proposal-service", () => ({
  ProposalService: { getProposalsByClient: (...a: unknown[]) => m.getProposalsByClient(...a) },
}));
vi.mock("@/services/transaction-service", () => ({
  TransactionService: { getTransactionsByClient: (...a: unknown[]) => m.getTransactionsByClient(...a) },
}));
vi.mock("@/services/fiscal-service", () => ({
  FiscalService: { listInvoices: (...a: unknown[]) => m.listInvoices(...a) },
}));
vi.mock("@/services/kanban-service", () => ({
  KanbanService: { getStatuses: async () => [] },
  getDefaultProposalColumns: () => [
    { label: "Em aberto", mappedStatus: "in_progress", category: "open" },
    { label: "Aprovada", mappedStatus: "approved", category: "won" },
  ],
}));
vi.mock("@/services/client-notes-service", () => ({
  ClientNotesService: {
    list: (...a: unknown[]) => m.listNotes(...a),
    create: (...a: unknown[]) => m.createNote(...a),
    remove: vi.fn(),
  },
}));

import { ContactHub } from "../contact-hub";

const CLIENT = { id: "c1", name: "Maria", phone: "11999998888", email: "maria@x.com" } as never;

function allow(...pages: string[]) {
  m.perms = Object.fromEntries(pages.map((p) => [p, { canView: true, canEdit: true }]));
}

beforeEach(() => {
  vi.clearAllMocks();
  m.aba = null;
  m.plan = { hasFinancial: true, hasFiscal: true };
  allow("proposals", "transactions", "invoices", "clients");
  m.getProposalsByClient.mockResolvedValue([
    { id: "p1", title: "Casa", status: "approved", totalValue: 1000 },
    { id: "p2", title: "Sala", status: "in_progress", totalValue: 500 },
  ]);
  m.getTransactionsByClient.mockResolvedValue([
    { id: "t1", description: "Entrada", type: "income", status: "paid", amount: 300, date: "2026-09-01" },
    { id: "t2", description: "Parcela", type: "income", status: "overdue", amount: 200, dueDate: "2026-09-10" },
  ]);
  m.listInvoices.mockResolvedValue({ invoices: [] });
  m.listNotes.mockResolvedValue([]);
});

describe("ContactHub", () => {
  it("resumo mostra propostas e financeiro do contato", async () => {
    render(<ContactHub client={CLIENT} dataTab={<div>form</div>} />);

    expect(await screen.findByText(/1 aprovada\(s\), 1 em aberto/)).toBeInTheDocument();
    expect(await screen.findByText(/Vencido/)).toBeInTheDocument();
  });

  it("membro sem acesso ao financeiro não vê a aba nem os valores", async () => {
    allow("proposals", "clients");
    render(<ContactHub client={CLIENT} dataTab={<div>form</div>} />);

    await screen.findByText(/1 aprovada/);
    expect(screen.queryByRole("tab", { name: "Financeiro" })).toBeNull();
    expect(screen.queryByText(/Recebido/)).toBeNull();
    expect(m.getTransactionsByClient).not.toHaveBeenCalled();
  });

  it("plano sem financeiro não busca lançamentos", async () => {
    m.plan = { hasFinancial: false, hasFiscal: false };
    render(<ContactHub client={CLIENT} dataTab={<div>form</div>} />);

    await screen.findByText(/1 aprovada/);
    expect(screen.queryByRole("tab", { name: "Financeiro" })).toBeNull();
    expect(m.getTransactionsByClient).not.toHaveBeenCalled();
    expect(m.listInvoices).not.toHaveBeenCalled();
  });

  it("sem permissão de propostas, a aba some e nada é buscado", async () => {
    allow("clients");
    render(<ContactHub client={CLIENT} dataTab={<div>form</div>} />);

    expect(screen.queryByRole("tab", { name: "Propostas" })).toBeNull();
    expect(m.getProposalsByClient).not.toHaveBeenCalled();
  });

  it("só mostra as notas do contato, mesmo se o backend devolver as da empresa toda", async () => {
    m.listInvoices.mockResolvedValue({
      invoices: [
        { id: "i1", clientId: "c1", type: "nfe", numero: "101", status: "authorized", valorTotal: 1000, createdAt: "2026-09-01" },
        { id: "i2", clientId: "outro", type: "nfe", numero: "202", status: "authorized", valorTotal: 500, createdAt: "2026-09-02" },
        { id: "i3", type: "nfse", numero: "303", status: "authorized", valorTotal: 300, createdAt: "2026-09-03" },
      ],
    });
    render(<ContactHub client={CLIENT} dataTab={<div>form</div>} />);
    await userEvent.click(await screen.findByRole("tab", { name: "Financeiro" }));

    expect(await screen.findByText(/nº 101/)).toBeInTheDocument();
    expect(screen.queryByText(/nº 202/)).toBeNull();
    expect(screen.queryByText(/nº 303/)).toBeNull();
    expect(m.listInvoices).toHaveBeenCalledWith({ clientId: "c1" });
  });

  it("?aba=dados abre direto no formulário", () => {
    m.aba = "dados";
    render(<ContactHub client={CLIENT} dataTab={<div>formulário</div>} />);
    expect(screen.getByText("formulário")).toBeInTheDocument();
  });

  it("grava uma anotação e ela aparece na lista", async () => {
    m.createNote.mockResolvedValue({
      id: "n1",
      text: "Pediu orçamento da varanda",
      authorId: "u1",
      authorName: "Ana",
      createdAt: "2026-09-25T12:00:00.000Z",
    });
    render(<ContactHub client={CLIENT} dataTab={<div>form</div>} />);
    await userEvent.click(screen.getByRole("tab", { name: "Anotações" }));
    await userEvent.type(screen.getByLabelText("Nova anotação"), "Pediu orçamento da varanda");
    await userEvent.click(screen.getByRole("button", { name: "Salvar anotação" }));

    expect(m.createNote).toHaveBeenCalledWith("c1", "Pediu orçamento da varanda");
    expect(await screen.findByText("Pediu orçamento da varanda")).toBeInTheDocument();
  });

  it("quem só vê o contato não tem campo de anotação", async () => {
    m.perms = { clients: { canView: true, canEdit: false } };
    render(<ContactHub client={CLIENT} dataTab={<div>form</div>} />);
    await userEvent.click(screen.getByRole("tab", { name: "Anotações" }));
    expect(screen.queryByLabelText("Nova anotação")).toBeNull();
  });
});
