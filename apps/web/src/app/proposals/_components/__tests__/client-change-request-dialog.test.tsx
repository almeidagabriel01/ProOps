// @vitest-environment jsdom
/** Pedido de mudanças no ERP: mostra o que o cliente pediu, leva à edição ou encerra. */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientChangeRequestDialog } from "../client-change-request-dialog";

const REQUEST = {
  name: "Maria",
  message: "O prazo combinado era de 30 dias e faltou a cortina do quarto.",
  requestedAt: "2026-09-26T13:00:00.000Z",
  status: "open" as const,
};

function setup(over: Partial<React.ComponentProps<typeof ClientChangeRequestDialog>> = {}) {
  const props = {
    proposalTitle: "Casa da Maria",
    request: REQUEST,
    canDecide: true,
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onResolve: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(<ClientChangeRequestDialog {...props} />);
  return props;
}

describe("ClientChangeRequestDialog", () => {
  it("mostra quem pediu e a justificativa inteira", () => {
    setup();
    expect(screen.getByText(/Maria pediu ajustes/)).toBeInTheDocument();
    expect(screen.getByText(REQUEST.message)).toBeInTheDocument();
  });

  it("editar leva para a proposta", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /Editar proposta/ }));
    expect(props.onEdit).toHaveBeenCalled();
    expect(props.onResolve).not.toHaveBeenCalled();
  });

  it("marcar como resolvido encerra e fecha", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /Marcar como resolvido/ }));
    expect(props.onResolve).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("se encerrar falhar, continua aberto", async () => {
    const props = setup({ onResolve: vi.fn().mockRejectedValue(new Error("x")) });
    await userEvent.click(screen.getByRole("button", { name: /Marcar como resolvido/ }));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("quem não edita propostas só lê", () => {
    setup({ canDecide: false });
    expect(screen.queryByRole("button", { name: /Editar proposta/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Marcar como resolvido/ })).toBeNull();
    expect(screen.getByText(REQUEST.message)).toBeInTheDocument();
  });

  it("sem nome, trata como o cliente", () => {
    setup({ request: { ...REQUEST, name: null } });
    expect(screen.getByText(/O cliente pediu ajustes/)).toBeInTheDocument();
  });
});
