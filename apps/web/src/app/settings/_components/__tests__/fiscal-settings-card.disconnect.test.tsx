// @vitest-environment jsdom
/**
 * Desconectar a emissão fiscal.
 *
 * O que torna isso mais delicado que um "remover" comum: a senha do certificado
 * fica cifrada em KMS e **não é recuperável**, e a numeração precisa continuar
 * de onde parou — reinformar errado vira rejeição por duplicidade no fisco.
 *
 * Por isso o botão só existe quando há o que desconectar, o diálogo diz o que
 * será preciso na volta, e o formulário é ZERADO junto: campos preenchidos
 * sobre uma configuração que não existe mais fariam o próximo "Salvar" recriar
 * tudo menos o certificado — um emitente meio configurado, que parece pronto e
 * falha na emissão.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { getSettings, disconnect } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/services/fiscal-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/fiscal-service")>();
  return {
    ...actual,
    FiscalService: {
      getSettings,
      disconnect,
      saveSettings: vi.fn(),
      registerIssuer: vi.fn(),
      lookupCnpj: vi.fn(),
      retryWebhooks: vi.fn(),
    },
  };
});
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  callApi: vi.fn(),
}));

import { FiscalSettingsCard } from "../fiscal-settings-card";

/** O GET nunca devolve null: sem configuração ele responde `configured: false`. */
const NAO_CONFIGURADO = { configured: false };

const CONFIGURADO = {
  configured: true,
  provider: "focus",
  environment: "homologacao",
  status: "ready",
  cnpj: "50759330000133",
  razaoSocial: "EMPRESA TESTE",
  regimeTributario: 1,
  email: "fiscal@exemplo.com.br",
  endereco: {
    logradouro: "Rua A",
    numero: "1",
    bairro: "Centro",
    municipio: "Machado",
    codigoIbge: "3139003",
    uf: "MG",
    cep: "37750000",
  },
  habilitaNfe: false,
  habilitaNfse: true,
  serieNfse: "1",
};

const botaoDesconectar = () =>
  screen.getAllByRole("button", { name: "Desconectar" });

beforeEach(() => {
  vi.clearAllMocks();
  disconnect.mockResolvedValue({ message: "ok" });
});

describe("FiscalSettingsCard — desconectar", () => {
  it("não oferece desconectar quando nada foi configurado", async () => {
    // Botão de remover numa conta que ainda não configurou é ruído — e assusta
    // antes da hora.
    getSettings.mockResolvedValue(NAO_CONFIGURADO);
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    expect(screen.queryByText("Desconectar emissão")).toBeNull();
  });

  it("oferece desconectar quando há configuração", async () => {
    getSettings.mockResolvedValue(CONFIGURADO);
    render(<FiscalSettingsCard />);

    await waitFor(() =>
      expect(screen.getByText("Desconectar emissão")).toBeInTheDocument(),
    );
  });

  it("avisa o que será preciso na volta antes de confirmar", async () => {
    getSettings.mockResolvedValue(CONFIGURADO);
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(botaoDesconectar()[0]).toBeInTheDocument());
    await userEvent.click(botaoDesconectar()[0]);

    expect(
      screen.getByText("Desconectar a emissão de notas?"),
    ).toBeInTheDocument();
    // As duas consequências que ninguém adivinha.
    const dialogo = screen.getByRole("alertdialog");
    expect(dialogo).toHaveTextContent(/senha/);
    expect(dialogo).toHaveTextContent(/duplicidade/);
    // Nada aconteceu ainda.
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("cancelar não desconecta", async () => {
    getSettings.mockResolvedValue(CONFIGURADO);
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(botaoDesconectar()[0]).toBeInTheDocument());
    await userEvent.click(botaoDesconectar()[0]);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(disconnect).not.toHaveBeenCalled();
  });

  it("desconecta e limpa o formulário", async () => {
    getSettings.mockResolvedValue(CONFIGURADO);
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(botaoDesconectar()[0]).toBeInTheDocument());
    const cnpj = screen.getByLabelText(/CNPJ/i) as HTMLInputElement;
    expect(cnpj.value).not.toBe("");

    await userEvent.click(botaoDesconectar()[0]);
    // O segundo é o do diálogo — o primeiro é o do card.
    await userEvent.click(botaoDesconectar().at(-1)!);

    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
    // Formulário zerado: sem isto o próximo "Salvar" recriaria a configuração
    // sem o certificado, e o emitente pareceria pronto sem estar.
    await waitFor(() => expect(cnpj.value).toBe(""));
    // E a seção some, porque não há mais o que desconectar.
    await waitFor(() => expect(screen.queryByText("Desconectar emissão")).toBeNull());
  });
});
