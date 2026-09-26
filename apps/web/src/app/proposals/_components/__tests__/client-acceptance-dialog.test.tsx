// @vitest-environment jsdom
/**
 * Revisão do aceite do cliente no ERP: confirmar aprova (e gera o financeiro),
 * ajustar descarta o aceite. Quem não edita propostas só vê a informação, e um
 * erro na ação deixa o diálogo aberto para tentar de novo.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClientAcceptanceDialog } from "../client-acceptance-dialog";

const ACCEPTANCE = {
  name: "Maria Souza",
  document: "52998224725",
  acceptedAt: "2026-09-26T13:00:00.000Z",
  status: "pending" as const,
};

function setup(over: Partial<React.ComponentProps<typeof ClientAcceptanceDialog>> = {}) {
  const props = {
    proposalTitle: "Casa da Maria",
    acceptance: ACCEPTANCE,
    canDecide: true,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    onAdjust: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
  render(<ClientAcceptanceDialog {...props} />);
  return props;
}

describe("ClientAcceptanceDialog", () => {
  it("mostra quem aceitou, com o documento formatado, e diz que nada foi lançado", () => {
    setup();
    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
    expect(screen.getByText(/Nada foi\s+lançado ainda/)).toBeInTheDocument();
  });

  it("confirmar chama a aprovação e fecha", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /Confirmar aprovação/ }));
    expect(props.onConfirm).toHaveBeenCalled();
    expect(props.onAdjust).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("ajustar descarta o aceite e fecha", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /Ajustar a proposta/ }));
    expect(props.onAdjust).toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("se a confirmação falhar, o diálogo continua aberto", async () => {
    const props = setup({ onConfirm: vi.fn().mockRejectedValue(new Error("falhou")) });
    await userEvent.click(screen.getByRole("button", { name: /Confirmar aprovação/ }));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Confirmar aprovação/ })).toBeEnabled();
  });

  it("quem não edita propostas não vê os botões", () => {
    setup({ canDecide: false });
    expect(screen.queryByRole("button", { name: /Confirmar aprovação/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Ajustar a proposta/ })).toBeNull();
    expect(screen.getByText(/Quem pode editar propostas/)).toBeInTheDocument();
  });

  it("sem aceite, não abre", () => {
    setup({ acceptance: null });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
