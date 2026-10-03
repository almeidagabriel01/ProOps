// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  view: vi.fn(),
  open: vi.fn(),
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/services/client-portal-service", () => ({
  ClientPortalService: {
    publicView: (...a: unknown[]) => m.view(...a),
    openItem: (...a: unknown[]) => m.open(...a),
  },
}));
vi.mock("@/lib/toast", () => ({ toast: m.toast }));

import { PublicClientPortal } from "../public-client-portal";

function makeView(overrides: Record<string, unknown> = {}) {
  return {
    company: { name: "Casa Viva", logoUrl: null, primaryColor: "#ffffff" },
    client: { firstName: "Ana" },
    proposals: [
      { id: "p1", title: "Sala", code: "0001SP", state: "open", value: 1000, createdAt: null, validUntil: "2026-10-30" },
      { id: "p2", title: "Loja", code: null, state: "approved", value: 5000, createdAt: null, validUntil: null },
    ],
    payments: [
      { id: "t1", description: "Parcela 1", amount: 500, dueDate: "2026-09-01", status: "overdue", isDownPayment: false },
      { id: "t0", description: "Entrada", amount: 500, dueDate: "2026-08-01", status: "paid", isDownPayment: true },
    ],
    canPayOnline: true,
    projects: [{ id: "o1", title: "Obra da loja", status: "active", stagesDone: 1, stagesTotal: 4, deliveryAccepted: false }],
    invoices: [{ id: "n1", type: "nfse", number: "58", amount: 500, issuedAt: "2026-08-01", pdfUrl: "https://focus.test/n1.pdf" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.view.mockResolvedValue(makeView());
  m.open.mockResolvedValue("https://erp.test/share/abc");
});

describe("portal do cliente", () => {
  it("mostra tudo do cliente, com o que está em aberto primeiro", async () => {
    render(<PublicClientPortal token="tok123456789abcdef" navigate={vi.fn()} />);
    expect(await screen.findByText("Olá, Ana")).toBeInTheDocument();
    expect(m.view).toHaveBeenCalledWith("tok123456789abcdef");
    expect(screen.getByText("Você tem 1 pagamento em aberto.")).toBeInTheDocument();
    expect(screen.getByText("Em análise")).toBeInTheDocument();
    expect(screen.getByText("Vencida")).toBeInTheDocument();
    expect(screen.getByText("Em andamento: 1 de 4 etapas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute("href", "https://focus.test/n1.pdf");
  });

  it("proposta em aberto leva à página dela para responder", async () => {
    const navigate = vi.fn();
    render(<PublicClientPortal token="tok123456789abcdef" navigate={navigate} />);
    await userEvent.click(await screen.findByRole("button", { name: "Ver e responder" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://erp.test/share/abc"));
    expect(m.open).toHaveBeenCalledWith("tok123456789abcdef", "proposal", "p1");
  });

  it("com pagamento online, a parcela em aberto vira 'Pagar'; sem ele, 'Ver cobrança'", async () => {
    const { unmount } = render(<PublicClientPortal token="tok123456789abcdef" navigate={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Pagar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver recibo" })).toBeInTheDocument();
    unmount();

    m.view.mockResolvedValue(makeView({ canPayOnline: false }));
    render(<PublicClientPortal token="tok123456789abcdef" navigate={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Ver cobrança" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
  });

  it("sem nada ainda, diz o que vai aparecer", async () => {
    m.view.mockResolvedValue(makeView({ proposals: [], payments: [], projects: [], invoices: [] }));
    render(<PublicClientPortal token="tok123456789abcdef" navigate={vi.fn()} />);
    expect(await screen.findByText(/Ainda não há nada aqui/)).toBeInTheDocument();
  });

  it("falha ao abrir um item avisa e não navega", async () => {
    m.open.mockRejectedValue(new Error("404"));
    const navigate = vi.fn();
    render(<PublicClientPortal token="tok123456789abcdef" navigate={navigate} />);
    await userEvent.click(await screen.findByRole("button", { name: "Acompanhar" }));
    await waitFor(() => expect(m.toast.error).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it("link desligado ou trocado", async () => {
    m.view.mockRejectedValue(Object.assign(new Error("404"), { status: 404 }));
    render(<PublicClientPortal token="tok123456789abcdef" navigate={vi.fn()} />);
    expect(await screen.findByText("Link indisponível")).toBeInTheDocument();
  });

  it("mostra a próxima visita da obra", async () => {
    const start = new Date(2026, 9, 21, 8).toISOString();
    const end = new Date(2026, 9, 21, 11).toISOString();
    m.view.mockResolvedValue(
      makeView({
        projects: [
          {
            id: "o1",
            title: "Obra da loja",
            status: "active",
            stagesDone: 1,
            stagesTotal: 4,
            deliveryAccepted: false,
            nextVisit: { stageName: "Instalação", isAllDay: false, startsAt: start, endsAt: end, startDate: null, endDate: null },
          },
        ],
      }),
    );
    render(<PublicClientPortal token="tok123456789abcdef" navigate={vi.fn()} />);
    expect(await screen.findByText("Próxima visita (Instalação):")).toBeInTheDocument();
    expect(screen.getByText("qua, 21/10, 08:00 às 11:00")).toBeInTheDocument();
  });

  it("o exemplo da demonstração mostra uma visita marcada", () => {
    render(<PublicClientPortal token="exemplo" navigate={vi.fn()} />);
    expect(screen.getByText("Próxima visita (Configuração):")).toBeInTheDocument();
  });

  it("o exemplo da demonstração não chama a API nem abre item", async () => {
    const navigate = vi.fn();
    render(<PublicClientPortal token="exemplo" navigate={navigate} />);
    expect(screen.getByText(/portal de exemplo, com dados fictícios/)).toBeInTheDocument();
    expect(m.view).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Pagar" })[0]);
    expect(m.open).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(m.toast.info).toHaveBeenCalled();
  });

  describe("assistência técnica", () => {
    const fieldService = {
      contracts: [
        { id: "c1", code: "CT-0001", title: "PMOC da loja", type: "pmoc", monthlyAmount: 890, billingDay: 10, nextVisitDate: "2026-10-20", isPmoc: true },
        { id: "c2", code: "CT-0002", title: "Suporte", type: "support", monthlyAmount: 100, billingDay: 5, nextVisitDate: null, isPmoc: false },
      ],
      serviceOrders: [
        { id: "s1", code: "OS-0003", title: "Preventiva", state: "scheduled", date: "2099-01-10T11:00:00.000Z", technicianName: "Téo", signed: false },
        { id: "s2", code: "OS-0001", title: "Limpeza", state: "completed", date: "2026-09-10T14:00:00.000Z", technicianName: "Téo", signed: true },
      ],
    };

    it("mostra os contratos com a mensalidade e os atendimentos", async () => {
      m.view.mockResolvedValue(makeView(fieldService));
      render(<PublicClientPortal token="tok123456789abcdef" navigate={vi.fn()} />);
      expect(await screen.findByText("Contratos")).toBeInTheDocument();
      expect(screen.getByText(/R\$\s?890,00 por mês, vence todo dia 10/)).toBeInTheDocument();
      expect(screen.getByText("20/10/2026")).toBeInTheDocument();
      expect(screen.getByText("Agendado")).toBeInTheDocument();
      expect(screen.getByText("Concluído")).toBeInTheDocument();
      // Só o PMOC abre um documento; o agendado ainda não tem comprovante.
      expect(screen.getAllByRole("button", { name: "Ver o PMOC" })).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: "Ver comprovante" })).toHaveLength(1);
    });

    it("o comprovante e o PMOC abrem pela página pública de cada um", async () => {
      m.view.mockResolvedValue(makeView(fieldService));
      const navigate = vi.fn();
      render(<PublicClientPortal token="tok123456789abcdef" navigate={navigate} />);
      await userEvent.click(await screen.findByRole("button", { name: "Ver comprovante" }));
      await waitFor(() => expect(m.open).toHaveBeenCalledWith("tok123456789abcdef", "service_order", "s2"));
      await userEvent.click(screen.getByRole("button", { name: "Ver o PMOC" }));
      await waitFor(() => expect(m.open).toHaveBeenCalledWith("tok123456789abcdef", "pmoc", "c1"));
    });

    it("backend sem a assistência (campos ausentes) não quebra o portal", async () => {
      m.view.mockResolvedValue(makeView());
      render(<PublicClientPortal token="tok123456789abcdef" navigate={vi.fn()} />);
      expect(await screen.findByText("Olá, Ana")).toBeInTheDocument();
      expect(screen.queryByText("Contratos")).toBeNull();
      expect(screen.queryByText("Atendimentos")).toBeNull();
    });

    it("o exemplo da demonstração mostra um contrato e um atendimento", () => {
      render(<PublicClientPortal token="exemplo" navigate={vi.fn()} />);
      expect(screen.getByText("Suporte mensal da automação")).toBeInTheDocument();
      expect(screen.getByText("Ajuste dos cenários da sala")).toBeInTheDocument();
    });
  });
});
