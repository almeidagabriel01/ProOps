// @vitest-environment jsdom
/** Aceite da entrega pelo cliente: validação, envio e o estado de aceita. */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const accept = vi.hoisted(() => vi.fn());
vi.mock("@/services/projects-service", () => ({ SharedProjectService: { accept } }));

import { DeliveryAcceptance } from "../delivery-acceptance";

function setup(over: Partial<React.ComponentProps<typeof DeliveryAcceptance>> = {}) {
  const onAccepted = vi.fn();
  render(
    <DeliveryAcceptance
      token="tok"
      delivery={{ status: "sent", acceptance: null }}
      projectStatus="active"
      tenantName="Casa Inteligente"
      primaryColor="#ffffff"
      onAccepted={onAccepted}
      {...over}
    />,
  );
  return onAccepted;
}

beforeEach(() => accept.mockReset());

describe("DeliveryAcceptance", () => {
  it("envia nome, documento e confirmação", async () => {
    accept.mockResolvedValue({ acceptedAt: "2026-09-26T10:00:00.000Z" });
    const onAccepted = setup();
    await userEvent.click(screen.getByRole("button", { name: /Aceitar a entrega/ }));
    await userEvent.type(screen.getByLabelText("Nome completo"), "Maria Souza");
    await userEvent.type(screen.getByLabelText("CPF ou CNPJ"), "529.982.247-25");
    await userEvent.click(screen.getByRole("checkbox", { name: /Confirmo a entrega/ }));
    await userEvent.click(screen.getByRole("button", { name: /Confirmar a entrega/ }));

    expect(accept).toHaveBeenCalledWith("tok", { name: "Maria Souza", document: "529.982.247-25", accepted: true });
    expect(onAccepted).toHaveBeenCalledWith({ name: "Maria Souza", acceptedAt: "2026-09-26T10:00:00.000Z" });
  });

  it("documento inválido segura o envio", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /Aceitar a entrega/ }));
    await userEvent.type(screen.getByLabelText("Nome completo"), "Maria Souza");
    await userEvent.type(screen.getByLabelText("CPF ou CNPJ"), "111.111.111-11");
    await userEvent.click(screen.getByRole("checkbox", { name: /Confirmo a entrega/ }));
    expect(screen.getByText("CPF ou CNPJ inválido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar a entrega/ })).toBeDisabled();
  });

  it("empresa de cor branca: botão com texto escuro e borda visível", () => {
    setup();
    const button = screen.getByRole("button", { name: /Aceitar a entrega/ });
    expect(button).toHaveStyle({ color: "#1f2937", borderColor: "#d1d5db" });
  });

  it("já aceita: mostra quem aceitou e nenhum botão", () => {
    setup({ delivery: { status: "accepted", acceptance: { name: "Maria Souza", acceptedAt: "2026-09-26T10:00:00.000Z" } } });
    expect(screen.getByText(/Entrega aceita por Maria Souza/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("projeto cancelado: nada a aceitar", () => {
    const { container } = render(
      <DeliveryAcceptance
        token="tok"
        delivery={{ status: "sent", acceptance: null }}
        projectStatus="canceled"
        tenantName="Casa"
        onAccepted={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
