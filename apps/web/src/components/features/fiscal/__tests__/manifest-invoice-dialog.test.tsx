// @vitest-environment jsdom
/**
 * A manifestação é declaração formal perante a Receita e **não pode ser
 * desfeita**. Os testes aqui cobrem justamente o que torna um clique errado
 * caro: opção pré-selecionada, escolha herdada de outra nota, e justificativa
 * curta demais que só seria recusada depois de enviada.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { manifest } = vi.hoisted(() => ({ manifest: vi.fn() }));

vi.mock("@/services/received-invoice-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/received-invoice-service")>();
  return { ...actual, ReceivedInvoiceService: { manifest } };
});
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
// `api-client` inicializa o Firebase no import e estoura em jsdom; o service
// real só é carregado aqui pelas constantes e helpers puros.
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  callApi: vi.fn(),
}));

import { ManifestInvoiceDialog } from "../manifest-invoice-dialog";
import type { ReceivedInvoice } from "@/services/received-invoice-service";

const NOTA = {
  id: "r1",
  tenantId: "t1",
  chaveAcesso: "1".repeat(44),
  versao: 1,
  status: "resumo",
  emitenteCnpj: "11222333000181",
  emitenteNome: "Fornecedor Alfa",
  numero: "42",
  valorTotal: 1500,
  createdAt: "",
  updatedAt: "",
} as ReceivedInvoice;

function renderDialog(invoice: ReceivedInvoice | null = NOTA) {
  return render(
    <ManifestInvoiceDialog
      invoice={invoice}
      onClose={vi.fn()}
      onManifested={vi.fn()}
    />,
  );
}

const botaoRegistrar = () =>
  screen.getByRole("button", { name: /Registrar resposta/ });

beforeEach(() => {
  vi.clearAllMocks();
  manifest.mockResolvedValue({ ...NOTA, manifestacao: "confirmacao" });
});

describe("ManifestInvoiceDialog", () => {
  it("não pré-seleciona nenhuma opção", async () => {
    renderDialog();

    // Um default aqui seria a Receita recebendo a resposta que o sistema
    // escolheu, não a que a pessoa quis dar.
    for (const nome of [
      "Confirmo a compra",
      "Só dar ciência por enquanto",
      "A compra foi cancelada",
      "Não reconheço esta nota",
    ]) {
      expect(screen.getByText(nome).closest("button")).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    expect(botaoRegistrar()).toBeDisabled();
  });

  it("envia a manifestação escolhida", async () => {
    renderDialog();

    await userEvent.click(screen.getByText("Confirmo a compra"));
    await userEvent.click(botaoRegistrar());

    expect(manifest).toHaveBeenCalledWith("1".repeat(44), "confirmacao", undefined);
  });

  it("pede justificativa apenas em 'compra cancelada'", async () => {
    renderDialog();

    await userEvent.click(screen.getByText("Confirmo a compra"));
    expect(screen.queryByLabelText(/Por que a compra/)).toBeNull();

    await userEvent.click(screen.getByText("A compra foi cancelada"));
    expect(screen.getByLabelText(/Por que a compra/)).toBeInTheDocument();
  });

  it("trava o envio enquanto a justificativa não atinge o mínimo da SEFAZ", async () => {
    // Sem isto o texto curto só seria recusado depois de enviado, com a
    // mensagem vindo do backend longe do campo.
    renderDialog();

    await userEvent.click(screen.getByText("A compra foi cancelada"));
    expect(botaoRegistrar()).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/Por que a compra/), "curto");
    expect(botaoRegistrar()).toBeDisabled();

    await userEvent.type(
      screen.getByLabelText(/Por que a compra/),
      " mas agora passa dos quinze",
    );
    await waitFor(() => expect(botaoRegistrar()).toBeEnabled());
  });

  it("envia a justificativa junto quando ela é exigida", async () => {
    renderDialog();

    await userEvent.click(screen.getByText("A compra foi cancelada"));
    await userEvent.type(
      screen.getByLabelText(/Por que a compra/),
      "mercadoria devolvida por avaria",
    );
    await userEvent.click(botaoRegistrar());

    expect(manifest).toHaveBeenCalledWith(
      "1".repeat(44),
      "nao_realizada",
      "mercadoria devolvida por avaria",
    );
  });

  it("não herda a escolha ao abrir para outra nota", async () => {
    // O caminho mais curto para manifestar a nota errada: escolher numa,
    // fechar, abrir noutra e o botão já estar habilitado.
    const { rerender } = renderDialog();

    await userEvent.click(screen.getByText("Confirmo a compra"));
    expect(botaoRegistrar()).toBeEnabled();

    rerender(
      <ManifestInvoiceDialog
        invoice={{ ...NOTA, id: "r2", chaveAcesso: "2".repeat(44) }}
        onClose={vi.fn()}
        onManifested={vi.fn()}
      />,
    );

    await waitFor(() => expect(botaoRegistrar()).toBeDisabled());
  });

  it("identifica a nota para quem vai responder", () => {
    renderDialog();

    expect(screen.getByText("Fornecedor Alfa")).toBeInTheDocument();
    expect(screen.getByText(/nota 42/)).toBeInTheDocument();
  });
});
