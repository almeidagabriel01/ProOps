// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  plan: { hasBookingLink: true },
  perm: { canEdit: true },
  pending: vi.fn(),
  confirm: vi.fn(),
  decline: vi.fn(),
}));

vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/hooks/usePagePermission", () => ({ usePagePermission: () => m.perm }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/services/booking-service", () => ({
  BookingService: {
    pendingRequests: (...a: unknown[]) => m.pending(...a),
    confirmRequest: (...a: unknown[]) => m.confirm(...a),
    declineRequest: (...a: unknown[]) => m.decline(...a),
  },
}));

import { BookingRequestsButton } from "../booking-requests-button";

const REQUEST = {
  id: "req-1",
  eventId: "ev-1",
  visitTypeLabel: "Visita técnica",
  date: "2026-09-28",
  startMin: 600,
  durationMin: 60,
  name: "Carla",
  phone: "(11) 98888-7777",
  email: "carla@exemplo.com",
  address: "Rua A, 10",
  notes: null,
  status: "pending",
  createdAt: "2026-09-26T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.plan = { hasBookingLink: true };
  m.perm = { canEdit: true };
  m.pending.mockResolvedValue([REQUEST]);
  m.confirm.mockResolvedValue(undefined);
  m.decline.mockResolvedValue(undefined);
});

describe("pedidos de visita na Agenda", () => {
  it("mostra quantos esperam resposta e confirma um", async () => {
    const onChanged = vi.fn();
    render(<BookingRequestsButton onChanged={onChanged} />);
    await userEvent.click(await screen.findByRole("button", { name: /Pedidos de visita \(1\)/ }));

    expect(screen.getByText("Visita técnica: Carla")).toBeInTheDocument();
    expect(screen.getByText("segunda-feira, 28/09 às 10:00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", "https://wa.me/5511988887777");

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(m.confirm).toHaveBeenCalledWith("req-1"));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Pedidos de visita/ })).toBeNull();
  });

  it("recusa com recado para o cliente", async () => {
    render(<BookingRequestsButton onChanged={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: /Pedidos de visita/ }));
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await userEvent.type(screen.getByLabelText("Recado para o cliente"), "Pode ser semana que vem?");
    await userEvent.click(screen.getByRole("button", { name: "Recusar pedido" }));
    await waitFor(() => expect(m.decline).toHaveBeenCalledWith("req-1", "Pode ser semana que vem?"));
  });

  it("abre sozinho no pedido da notificação", async () => {
    render(<BookingRequestsButton onChanged={vi.fn()} highlightId="req-1" />);
    expect(await screen.findByText("Visita técnica: Carla")).toBeInTheDocument();
  });

  it("membro sem edição da Agenda vê o pedido, mas não responde", async () => {
    m.perm = { canEdit: false };
    render(<BookingRequestsButton onChanged={vi.fn()} />);
    await userEvent.click(await screen.findByRole("button", { name: /Pedidos de visita/ }));
    expect(screen.getByText("Visita técnica: Carla")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recusar" })).toBeNull();
  });

  it("some sem pedido pendente", async () => {
    m.pending.mockResolvedValue([]);
    render(<BookingRequestsButton onChanged={vi.fn()} />);
    await waitFor(() => expect(m.pending).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Pedidos de visita/ })).toBeNull();
  });

  it("some quando a busca falha (conta free leva 402)", async () => {
    m.pending.mockRejectedValue(Object.assign(new Error("402"), { status: 402 }));
    render(<BookingRequestsButton onChanged={vi.fn()} />);
    await waitFor(() => expect(m.pending).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /Pedidos de visita/ })).toBeNull();
  });

  it("sem o plano nem pergunta ao servidor", () => {
    m.plan = { hasBookingLink: false };
    render(<BookingRequestsButton onChanged={vi.fn()} />);
    expect(m.pending).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Pedidos de visita/ })).toBeNull();
  });
});
