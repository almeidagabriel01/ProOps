// @vitest-environment jsdom
/**
 * Aceite online no link público: o cliente informa nome, CPF/CNPJ e aceita.
 * O aceite NÃO aprova: a barra diz que a empresa vai confirmar, e nada de
 * pagamento é oferecido antes disso.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const accept = vi.hoisted(() => vi.fn());
vi.mock("@/services/shared-proposal-service", () => ({
  SharedProposalService: { accept },
}));

import { OnlineApprovalBar } from "../online-approval-bar";
import type { OnlineApprovalState } from "@/services/shared-proposal-service";

const OPEN: OnlineApprovalState = {
  canApprove: true,
  approved: false,
  expired: false,
  awaitingConfirmation: false,
  acceptance: null,
};

function renderBar(state: OnlineApprovalState = OPEN, onAccepted = vi.fn()) {
  render(
    <OnlineApprovalBar
      token="tok"
      state={state}
      tenantName="Casa Inteligente"
      primaryColor="#2563eb"
      onAccepted={onAccepted}
    />,
  );
  return onAccepted;
}

async function fillForm(document = "529.982.247-25") {
  await userEvent.click(screen.getByRole("button", { name: /aceitar proposta/i }));
  await userEvent.type(screen.getByLabelText(/nome completo/i), "Maria Souza");
  await userEvent.type(screen.getByLabelText(/cpf ou cnpj/i), document);
  await userEvent.click(screen.getByRole("checkbox"));
}

beforeEach(() => {
  accept.mockReset();
});

describe("OnlineApprovalBar", () => {
  it("envia o aceite e avisa que a empresa vai confirmar, sem oferecer pagamento", async () => {
    accept.mockResolvedValue({ acceptedAt: "2026-09-25T15:00:00.000Z" });
    const onAccepted = renderBar();
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /enviar aceite/i }));

    expect(accept).toHaveBeenCalledWith("tok", {
      name: "Maria Souza",
      document: "529.982.247-25",
      accepted: true,
    });
    expect(await screen.findByText("Aceite enviado")).toBeInTheDocument();
    expect(screen.getByText(/vai conferir e confirmar a\s+aprovação/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /pagar/i })).toBeNull();
    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ approved: false, awaitingConfirmation: true }),
    );
  });

  it("não deixa enviar sem aceitar ou com documento inválido", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: /aceitar proposta/i }));
    await userEvent.type(screen.getByLabelText(/nome completo/i), "Maria Souza");
    await userEvent.type(screen.getByLabelText(/cpf ou cnpj/i), "111.111.111-11");
    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByText("CPF ou CNPJ inválido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar aceite/i })).toBeDisabled();
  });

  it("mostra o erro do servidor sem fechar o diálogo", async () => {
    accept.mockRejectedValue(new Error("O aceite desta proposta já foi enviado."));
    renderBar();
    await fillForm();
    await userEvent.click(screen.getByRole("button", { name: /enviar aceite/i }));

    expect(await screen.findByText("O aceite desta proposta já foi enviado.")).toBeInTheDocument();
  });

  it("aceite aguardando a empresa: mostra quem aceitou e que falta a confirmação", () => {
    renderBar({
      canApprove: false,
      approved: false,
      expired: false,
      awaitingConfirmation: true,
      acceptance: { name: "Maria Souza", acceptedAt: "2026-09-25T15:00:00.000Z" },
    });
    expect(screen.getByText(/aceite enviado por maria souza/i)).toHaveTextContent(
      /casa inteligente vai confirmar/i,
    );
    expect(screen.queryByRole("button", { name: /aceitar proposta/i })).toBeNull();
  });

  it("proposta aprovada pela empresa mostra quem aceitou", () => {
    renderBar({
      canApprove: false,
      approved: true,
      expired: false,
      awaitingConfirmation: false,
      acceptance: { name: "Maria Souza", acceptedAt: "2026-09-25T15:00:00.000Z" },
    });
    expect(screen.getByText(/aprovada por maria souza/i)).toBeInTheDocument();
  });

  it("plano sem aceite online não mostra nada", () => {
    const { container } = render(
      <OnlineApprovalBar
        token="tok"
        state={{ canApprove: false, approved: false, expired: false, awaitingConfirmation: false, acceptance: null }}
        tenantName="Casa"
        onAccepted={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
