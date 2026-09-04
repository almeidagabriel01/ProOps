// @vitest-environment jsdom
/**
 * Data de início de recebimento das notas de entrada.
 *
 * O cliente da ProOps não tem painel do provedor — a conta é nossa, as empresas
 * são cadastradas sob ela. Sem este campo ele liga a recepção e fica no escuro
 * sobre de quando as notas vêm, e o default do provedor é o pior possível:
 * **em branco ele puxa todo o histórico disponível e cobra por nota**.
 *
 * E a escolha é IRREVERSÍVEL: depois de enviada ao provedor, ele não aceita
 * alterá-la. Por isso o padrão é hoje (ninguém paga pelo histórico sem pedir),
 * o custo está escrito na frente, e o campo trava quando já não vale mais
 * mudar.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { getSettings } = vi.hoisted(() => ({ getSettings: vi.fn() }));

vi.mock("@/services/fiscal-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/fiscal-service")>();
  return {
    ...actual,
    FiscalService: {
      getSettings,
      disconnect: vi.fn(),
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

const BASE = {
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
};

/**
 * O `DatePicker` do projeto não é um `<input type="date">`: ele mostra um botão
 * com a data formatada e mantém um input ESCONDIDO com o valor ISO. O valor é o
 * contrato (é o que vai no PUT); o botão é o que a pessoa vê e clica.
 */
const campoData = () =>
  document.getElementById("fiscal-data-inicio-recebimento") as HTMLInputElement | null;
const bloco = () => campoData()!.closest("div.rounded-md") as HTMLElement;
const gatilhoData = () => within(bloco()).getByRole("button");
const toggle = () =>
  screen.getByRole("switch", { name: "Receber notas dos fornecedores" });

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

beforeEach(() => vi.clearAllMocks());

describe("FiscalSettingsCard — data de início de recebimento", () => {
  it("não mostra o campo com a recepção desligada", async () => {
    // Não há o que decidir enquanto nada será recebido.
    getSettings.mockResolvedValue({ ...BASE, habilitaManifestacao: false });
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    expect(campoData()).toBeNull();
  });

  it("mostra o campo já preenchido com a data gravada", async () => {
    getSettings.mockResolvedValue({
      ...BASE,
      habilitaManifestacao: true,
      dataInicioRecebimento: "2026-01-15",
    });
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(campoData()).toHaveValue("2026-01-15"));
  });

  it("sugere HOJE ao ligar a recepção", async () => {
    // O default do provedor é o histórico inteiro, cobrado por nota. Deixar em
    // branco seria repassar essa conta a quem só ligou um toggle.
    getSettings.mockResolvedValue({ ...BASE, habilitaManifestacao: false });
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(getSettings).toHaveBeenCalled());
    await userEvent.click(toggle());

    await waitFor(() => expect(campoData()).toHaveValue(hojeIso()));
  });

  it("diz o custo de recuar a data antes de ela ser escolhida", async () => {
    getSettings.mockResolvedValue({ ...BASE, habilitaManifestacao: true });
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(campoData()).toBeInTheDocument());
    expect(bloco()).toHaveTextContent(/não são cobradas/);
    expect(bloco()).toHaveTextContent(/consome uma unidade do seu pacote/);
    // A irreversibilidade é o que ninguém adivinha.
    expect(bloco()).toHaveTextContent(/não pode mais ser alterada/);
  });

  it("mostra a data escolhida no gatilho, formatada", async () => {
    // O valor ISO é o contrato com o backend; o que a pessoa lê é isto.
    getSettings.mockResolvedValue({
      ...BASE,
      habilitaManifestacao: true,
      dataInicioRecebimento: "2026-01-15",
    });
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(gatilhoData()).toHaveTextContent("15/01/2026"));
  });

  it("avisa quando a data escolhida está no futuro", async () => {
    // O `max` do DatePicker só chega ao input escondido — o calendário não o
    // aplica. Sem este aviso, trocar o input nativo pelo componente padrão
    // teria perdido a trava em silêncio, e aqui o erro é permanente.
    getSettings.mockResolvedValue({
      ...BASE,
      habilitaManifestacao: true,
      dataInicioRecebimento: "2099-01-01",
    });
    render(<FiscalSettingsCard />);

    await waitFor(() =>
      expect(bloco()).toHaveTextContent(/nenhuma nota será recebida até lá/),
    );
  });

  it("trava o campo depois de a data ter ido para o provedor", async () => {
    // Oferecer edição do que o provedor já recusa faria a tela mentir sobre o
    // que está valendo lá.
    getSettings.mockResolvedValue({
      ...BASE,
      habilitaManifestacao: true,
      dataInicioRecebimento: "2026-01-15",
      dataInicioRecebimentoBloqueada: true,
    });
    render(<FiscalSettingsCard />);

    await waitFor(() => expect(gatilhoData()).toBeDisabled());
    expect(bloco()).toHaveTextContent(/já foi registrada no provedor fiscal/);
  });
});
