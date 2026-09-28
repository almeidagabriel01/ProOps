// @vitest-environment jsdom
/**
 * Resposta do cliente no link público: aceitar (fica pendente até a empresa
 * confirmar), pedir mudanças com justificativa obrigatória e, com a proposta
 * aprovada, ir para o pagamento. O painel fica em fluxo normal, não fixo
 * sobre o PDF.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const svc = vi.hoisted(() => ({ accept: vi.fn(), requestChanges: vi.fn(), paymentLink: vi.fn() }));
vi.mock("@/services/shared-proposal-service", () => ({ SharedProposalService: svc }));

import { ProposalResponsePanel } from "../proposal-response-panel";
import type { OnlineApprovalState, SharedChangeRequest } from "@/services/shared-proposal-service";

const OPEN: OnlineApprovalState = {
  canApprove: true,
  approved: false,
  expired: false,
  awaitingConfirmation: false,
  acceptance: null,
  canRequestChanges: true,
  changeRequest: null,
  payment: null,
};

const OPEN_REQUEST: SharedChangeRequest = {
  name: "Maria",
  message: "Faltou a cortina da sala",
  requestedAt: "2026-09-26T13:00:00.000Z",
  status: "open",
  resolvedAt: null,
};

const RESOLVED: SharedChangeRequest = {
  name: null,
  message: "Trocar o motor",
  requestedAt: "2026-09-20T13:00:00.000Z",
  status: "resolved",
  resolvedAt: "2026-09-22T13:00:00.000Z",
};

function renderPanel(
  state: OnlineApprovalState = OPEN,
  position: "start" | "end" = "start",
  onStateChange = vi.fn(),
) {
  const utils = render(
    <ProposalResponsePanel
      token="tok"
      state={state}
      tenantName="Casa Inteligente"
      primaryColor="#2563eb"
      onStateChange={onStateChange}
      position={position}
    />,
  );
  return { ...utils, onStateChange };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProposalResponsePanel", () => {
  it("fica em fluxo normal, não fixo sobre o documento", () => {
    renderPanel();
    const panel = screen.getByRole("region", { name: "Resposta à proposta" });
    expect(panel.className).not.toMatch(/\bfixed\b|\bsticky\b/);
    expect(panel).toHaveAttribute("data-pdf-ui");
  });

  it("aceitar envia nome, documento e aceite, e avisa que a empresa vai confirmar", async () => {
    svc.accept.mockResolvedValue({ acceptedAt: "2026-09-25T15:00:00.000Z" });
    const { onStateChange } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /aceitar proposta/i }));
    await userEvent.type(screen.getByLabelText(/nome completo/i), "Maria Souza");
    await userEvent.type(screen.getByLabelText(/cpf ou cnpj/i), "529.982.247-25");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /enviar aceite/i }));

    expect(svc.accept).toHaveBeenCalledWith("tok", {
      name: "Maria Souza",
      document: "529.982.247-25",
      accepted: true,
    });
    expect(await screen.findByText("Aceite enviado")).toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ awaitingConfirmation: true, canApprove: false, canRequestChanges: false }),
    );
  });

  it("documento inválido segura o envio do aceite", async () => {
    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /aceitar proposta/i }));
    await userEvent.type(screen.getByLabelText(/nome completo/i), "Maria Souza");
    await userEvent.type(screen.getByLabelText(/cpf ou cnpj/i), "111.111.111-11");
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("CPF ou CNPJ inválido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar aceite/i })).toBeDisabled();
  });

  it("pedir mudanças só libera o envio com justificativa", async () => {
    svc.requestChanges.mockResolvedValue({ requestedAt: "2026-09-26T10:00:00.000Z" });
    const { onStateChange } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /solicitar mudanças/i }));

    const send = screen.getByRole("button", { name: /enviar pedido/i });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/o que precisa mudar/i), "curto");
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/o que precisa mudar/i), " demais, o prazo era 30 dias");
    expect(send).toBeEnabled();
    await userEvent.click(send);

    expect(svc.requestChanges).toHaveBeenCalledWith("tok", {
      name: undefined,
      message: "curto demais, o prazo era 30 dias",
    });
    expect(await screen.findByText("Pedido enviado")).toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({
        canRequestChanges: false,
        changeRequest: { requestedAt: "2026-09-26T10:00:00.000Z" },
        changeRequests: [
          {
            name: null,
            message: "curto demais, o prazo era 30 dias",
            requestedAt: "2026-09-26T10:00:00.000Z",
            status: "open",
            resolvedAt: null,
          },
        ],
      }),
    );
  });

  it("pedido novo entra no topo do histórico que já existia", async () => {
    svc.requestChanges.mockResolvedValue({ requestedAt: "2026-09-28T10:00:00.000Z" });
    const { onStateChange } = renderPanel({ ...OPEN, changeRequests: [RESOLVED] });
    await userEvent.click(screen.getByRole("button", { name: /solicitar mudanças/i }));
    await userEvent.type(screen.getByLabelText(/o que precisa mudar/i), "Faltou a persiana do escritório");
    await userEvent.click(screen.getByRole("button", { name: /enviar pedido/i }));
    await screen.findByText("Pedido enviado");
    const next = onStateChange.mock.calls[0][0] as OnlineApprovalState;
    expect(next.changeRequests?.map((r) => r.requestedAt)).toEqual([
      "2026-09-28T10:00:00.000Z",
      RESOLVED.requestedAt,
    ]);
  });

  it("pedido aberto: avisa que a empresa está revisando e ainda deixa aceitar", () => {
    renderPanel({ ...OPEN, canRequestChanges: false, changeRequest: { requestedAt: "2026-09-26T10:00:00.000Z" } });
    expect(screen.getByText(/pedido de mudanças foi enviado/i)).toHaveTextContent(/está\s+revisando/i);
    expect(screen.queryByRole("button", { name: /solicitar mudanças/i })).toBeNull();
    expect(screen.getByRole("button", { name: /aceitar proposta/i })).toBeInTheDocument();
  });

  it("aprovada com pagamento: botão leva ao link de pagamento", async () => {
    svc.paymentLink.mockResolvedValue({ url: "https://erp/share/transaction/x" });
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, set href(v: string) { assign(v); } },
    });
    renderPanel({
      ...OPEN,
      canApprove: false,
      canRequestChanges: false,
      approved: true,
      acceptance: { name: "Gabriel Almeida", acceptedAt: "2026-09-26T10:00:00.000Z" },
      payment: { label: "Pagar entrada" },
    });
    expect(screen.getByText(/aprovada por gabriel almeida/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /pagar entrada/i }));
    expect(svc.paymentLink).toHaveBeenCalledWith("tok");
    expect(assign).toHaveBeenCalledWith("https://erp/share/transaction/x");
  });

  it("aprovada sem pagamento online: só o status, sem botão", () => {
    renderPanel({ ...OPEN, canApprove: false, canRequestChanges: false, approved: true });
    expect(screen.getByText("Proposta aprovada.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("no fim do documento, só aparece quando há o que fazer", () => {
    const { container } = renderPanel(
      { ...OPEN, canApprove: false, canRequestChanges: false, awaitingConfirmation: true },
      "end",
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("com pedidos, o botão do histórico abre todos com o status", async () => {
    renderPanel({
      ...OPEN,
      canRequestChanges: false,
      changeRequest: { requestedAt: OPEN_REQUEST.requestedAt },
      changeRequests: [OPEN_REQUEST, RESOLVED],
    });
    await userEvent.click(screen.getByRole("button", { name: "Histórico de solicitações (2)" }));
    const dialog = await screen.findByRole("dialog", { name: "Histórico de solicitações" });
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Em análise");
    expect(items[0]).toHaveTextContent("Faltou a cortina da sala");
    expect(items[0]).toHaveTextContent("por Maria");
    expect(items[1]).toHaveTextContent("Resolvida");
    expect(items[1]).toHaveTextContent("Resolvida em 22/09/2026");
    expect(items[1]).toHaveTextContent("Trocar o motor");
  });

  it("só pedidos resolvidos: o painel aparece no topo com o histórico, mesmo sem ação", () => {
    renderPanel({ ...OPEN, canApprove: false, canRequestChanges: false, changeRequests: [RESOLVED] });
    expect(screen.getByRole("button", { name: "Histórico de solicitações (1)" })).toBeInTheDocument();
  });

  it("sem pedido, ou backend sem o histórico: sem botão", () => {
    renderPanel({ ...OPEN, changeRequests: [] });
    expect(screen.queryByRole("button", { name: /histórico de solicitações/i })).toBeNull();
  });

  it("plano sem aceite online não mostra nada", () => {
    const { container } = renderPanel({ ...OPEN, canApprove: false, canRequestChanges: false });
    expect(container).toBeEmptyDOMElement();
  });
});
