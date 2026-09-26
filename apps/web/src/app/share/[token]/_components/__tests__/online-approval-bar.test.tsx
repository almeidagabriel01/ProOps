// @vitest-environment jsdom
/**
 * Aprovação online no link público: o cliente informa nome, CPF/CNPJ e aceita.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const approve = vi.hoisted(() => vi.fn());
vi.mock("@/services/shared-proposal-service", () => ({
  SharedProposalService: { approve },
}));

import { OnlineApprovalBar } from "../online-approval-bar";

const OPEN = { canApprove: true, approved: false, expired: false, acceptance: null };

function renderBar(state = OPEN, onApproved = vi.fn()) {
  render(
    <OnlineApprovalBar
      token="tok"
      state={state}
      tenantName="Casa Inteligente"
      primaryColor="#2563eb"
      onApproved={onApproved}
    />,
  );
  return onApproved;
}

async function fillAndConfirm(document = "529.982.247-25") {
  await userEvent.click(screen.getByRole("button", { name: /aprovar proposta/i }));
  await userEvent.type(screen.getByLabelText(/nome completo/i), "Maria Souza");
  await userEvent.type(screen.getByLabelText(/cpf ou cnpj/i), document);
  await userEvent.click(screen.getByRole("checkbox"));
}

beforeEach(() => {
  approve.mockReset();
});

describe("OnlineApprovalBar", () => {
  it("aprova com nome, documento e aceite, e oferece pagar a entrada", async () => {
    approve.mockResolvedValue({
      acceptedAt: "2026-09-25T15:00:00.000Z",
      paymentUrl: "https://erp/share/transaction/x",
    });
    const onApproved = renderBar();
    await fillAndConfirm();
    await userEvent.click(screen.getByRole("button", { name: /confirmar aprovação/i }));

    expect(approve).toHaveBeenCalledWith("tok", {
      name: "Maria Souza",
      document: "529.982.247-25",
      accepted: true,
    });
    expect(await screen.findByText("Proposta aprovada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pagar a entrada/i })).toHaveAttribute(
      "href",
      "https://erp/share/transaction/x",
    );
    expect(onApproved).toHaveBeenCalledWith(expect.objectContaining({ approved: true }));
  });

  it("não deixa confirmar sem aceitar ou com documento inválido", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: /aprovar proposta/i }));
    await userEvent.type(screen.getByLabelText(/nome completo/i), "Maria Souza");
    await userEvent.type(screen.getByLabelText(/cpf ou cnpj/i), "111.111.111-11");
    await userEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByText("CPF ou CNPJ inválido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar aprovação/i })).toBeDisabled();
  });

  it("mostra o erro do servidor sem fechar o diálogo", async () => {
    approve.mockRejectedValue(new Error("Esta proposta já foi aprovada."));
    renderBar();
    await fillAndConfirm();
    await userEvent.click(screen.getByRole("button", { name: /confirmar aprovação/i }));

    expect(await screen.findByText("Esta proposta já foi aprovada.")).toBeInTheDocument();
  });

  it("proposta já aprovada mostra quem aprovou e quando", () => {
    renderBar({
      canApprove: false,
      approved: true,
      expired: false,
      acceptance: { name: "Maria Souza", acceptedAt: "2026-09-25T15:00:00.000Z" },
    });
    expect(screen.getByText(/aprovada por maria souza/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /aprovar proposta/i })).toBeNull();
  });

  it("plano sem aprovação online não mostra nada", () => {
    const { container } = render(
      <OnlineApprovalBar
        token="tok"
        state={{ canApprove: false, approved: false, expired: false, acceptance: null }}
        tenantName="Casa"
        onApproved={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
