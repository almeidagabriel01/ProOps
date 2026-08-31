// @vitest-environment jsdom
/**
 * O campo de CPF/CNPJ só existe enquanto o contato está sendo criado — é a
 * única janela em que esses dados são gravados por este formulário.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProposalClientSection } from "../proposal-client-section";

vi.mock("@/components/features/client-select", () => ({
  ClientSelect: () => <input aria-label="Contato" />,
}));

function renderSection(props: Record<string, unknown> = {}) {
  return render(
    <ProposalClientSection
      formData={{ clientName: "José Francisco" }}
      onFormChange={vi.fn()}
      onClientChange={vi.fn()}
      isNewClient
      onNewClientDocumentChange={vi.fn()}
      {...props}
    />,
  );
}

describe("ProposalClientSection — CPF/CNPJ", () => {
  it("oferece o campo ao cadastrar um contato novo", () => {
    renderSection();
    expect(screen.getByLabelText(/CPF ou CNPJ/i)).toBeInTheDocument();
  });

  it("não oferece o campo para um contato já existente", () => {
    // Ali o documento vive no cadastro do contato; editar por aqui daria a
    // impressão de salvar algo que a proposta não grava.
    renderSection({ isNewClient: false });
    expect(screen.queryByLabelText(/CPF ou CNPJ/i)).toBeNull();
  });

  it("não oferece o campo antes de haver um nome digitado", () => {
    renderSection({ formData: {} });
    expect(screen.queryByLabelText(/CPF ou CNPJ/i)).toBeNull();
  });

  it("mascara enquanto se digita", async () => {
    const onNewClientDocumentChange = vi.fn();
    renderSection({ onNewClientDocumentChange });

    await userEvent.type(screen.getByLabelText(/CPF ou CNPJ/i), "1");

    expect(onNewClientDocumentChange).toHaveBeenCalledWith("1");
  });

  it("acusa documento inválido no próprio campo", () => {
    renderSection({ newClientDocument: "111.111.111-11" });
    expect(screen.getByText("CPF ou CNPJ inválido")).toBeInTheDocument();
  });

  it("não acusa erro num documento válido", () => {
    renderSection({ newClientDocument: "529.982.247-25" });
    expect(screen.queryByText("CPF ou CNPJ inválido")).toBeNull();
  });
});
