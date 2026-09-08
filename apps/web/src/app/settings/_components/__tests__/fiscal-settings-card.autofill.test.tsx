// @vitest-environment jsdom
/**
 * Preenchimento automático a partir do CNPJ e do CEP.
 *
 * É o que faz esta tela não ser um formulário de 20 campos: pede o CNPJ, busca
 * na Receita e preenche razão social, fantasia, CNAE, regime tributário e o
 * endereço inteiro — código IBGE incluído, que ninguém digita e é uma das
 * rejeições mais comuns quando falta.
 *
 * O que estes testes guardam depois da quebra em passos: o endereço preenchido
 * pela busca vive num passo DIFERENTE do campo de CNPJ. Um wizard que mantivesse
 * estado por passo (ou remontasse o passo ao abrir) jogaria esse preenchimento
 * fora sem erro nenhum — a pessoa buscaria o CNPJ, avançaria, e o endereço
 * estaria vazio.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { getSettings, lookupCnpj } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  lookupCnpj: vi.fn(),
}));

vi.mock("@/services/fiscal-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/fiscal-service")>();
  return {
    ...actual,
    FiscalService: {
      getSettings,
      lookupCnpj,
      saveSettings: vi.fn(),
      disconnect: vi.fn(),
      registerIssuer: vi.fn(),
      retryWebhooks: vi.fn(),
    },
  };
});

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: toastSuccess, error: toastError, info: vi.fn() },
}));
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  callApi: vi.fn(),
}));

import { FiscalSettingsCard } from "../fiscal-settings-card";

const RECEITA = {
  cnpj: "50759330000133",
  razaoSocial: "EMPRESA TESTE LTDA",
  nomeFantasia: "TESTE",
  cnae: "4321500",
  regimeTributario: 3 as const,
  situacaoCadastral: "Ativa",
  logradouro: "Rua das Flores",
  numero: "100",
  complemento: "Sala 2",
  bairro: "Centro",
  municipio: "Machado",
  codigoIbge: "3139003",
  uf: "MG",
  cep: "37750000",
};

const campo = (label: RegExp | string) =>
  screen.getByLabelText(label) as HTMLInputElement;

async function esperarCarregar(): Promise<void> {
  await screen.findByRole("heading", { name: "Dados da empresa" });
}

/** Abre o passo do endereço pela trilha — só quem já configurou pula adiante. */
async function abrirPassoEndereco(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: /Endereço/ }));
  await screen.findByRole("heading", { name: "Endereço do emitente" });
}

beforeEach(() => {
  vi.clearAllMocks();
  getSettings.mockResolvedValue({ configured: false });
  lookupCnpj.mockResolvedValue(RECEITA);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FiscalSettingsCard — preenchimento automático pelo CNPJ", () => {
  it("preenche os dados da empresa no passo 1", async () => {
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(campo(/CNPJ/), "50759330000133");
    await userEvent.click(screen.getByRole("button", { name: /Buscar/ }));

    await waitFor(() => expect(lookupCnpj).toHaveBeenCalledWith("50759330000133"));
    await waitFor(() =>
      expect(campo(/Razão social/)).toHaveValue("EMPRESA TESTE LTDA"),
    );
    expect(campo(/Nome fantasia/)).toHaveValue("TESTE");
    expect(campo(/CNAE principal/)).toHaveValue("4321500");
    // A Receita sabe se a empresa é optante do Simples — errar isto troca CSOSN
    // por CST na nota inteira.
    expect(screen.getByLabelText(/Regime tributário/)).toHaveValue("3");
    expect(toastSuccess).toHaveBeenCalledWith("Dados da empresa preenchidos.");
  });

  it("preenche o endereço, que vive em OUTRO passo", async () => {
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(campo(/CNPJ/), "50759330000133");
    await userEvent.click(screen.getByRole("button", { name: /Buscar/ }));
    await waitFor(() => expect(lookupCnpj).toHaveBeenCalled());

    // O passo 1 já está válido, então o "Próximo" leva ao endereço.
    await userEvent.type(
      campo(/E-mail fiscal/),
      "fiscal@exemplo.com.br",
    );
    await userEvent.click(screen.getByRole("button", { name: /Próximo/ }));
    await screen.findByRole("heading", { name: "Endereço do emitente" });

    expect(campo(/^CEP/)).toHaveValue("37750-000");
    expect(campo(/Logradouro/)).toHaveValue("Rua das Flores");
    expect(campo(/^Número/)).toHaveValue("100");
    expect(campo(/Complemento/)).toHaveValue("Sala 2");
    expect(campo(/Bairro/)).toHaveValue("Centro");
    expect(campo(/Município/)).toHaveValue("Machado");
    expect(campo(/^UF/)).toHaveValue("MG");
    expect(campo(/Código IBGE/)).toHaveValue("3139003");
  });

  it("não consulta a Receita com dígito verificador errado", async () => {
    // Digitação errada é problema no teclado de quem preenche; "não encontramos"
    // mandaria a pessoa procurar o erro na Receita.
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(campo(/CNPJ/), "12345678901234");
    await userEvent.click(screen.getByRole("button", { name: /Buscar/ }));

    expect(lookupCnpj).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Esse CNPJ não é válido.",
      expect.objectContaining({ description: expect.stringContaining("dígitos") }),
    );
  });

  it("avisa quando o CNPJ não está ativo, mas preenche o que veio", async () => {
    // CNPJ baixado passa no cadastro e só falha na emissão, com certificado já
    // enviado e nota montada.
    lookupCnpj.mockResolvedValue({ ...RECEITA, situacaoCadastral: "Baixada" });
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(campo(/CNPJ/), "50759330000133");
    await userEvent.click(screen.getByRole("button", { name: /Buscar/ }));

    await waitFor(() =>
      expect(campo(/Razão social/)).toHaveValue("EMPRESA TESTE LTDA"),
    );
    expect(toastError).toHaveBeenCalledWith(
      'CNPJ com situação cadastral "Baixada".',
      expect.objectContaining({ description: expect.stringContaining("ativo") }),
    );
  });

  it("busca falhando não trava o formulário", async () => {
    lookupCnpj.mockRejectedValue(new Error("timeout"));
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(campo(/CNPJ/), "50759330000133");
    await userEvent.click(screen.getByRole("button", { name: /Buscar/ }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Não encontramos esse CNPJ. Preencha os dados manualmente.",
      ),
    );
    // O CNPJ digitado continua lá e o botão volta a funcionar.
    expect(campo(/CNPJ/)).toHaveValue("50.759.330/0001-33");
    expect(screen.getByRole("button", { name: /Buscar/ })).toBeEnabled();
  });
});

describe("FiscalSettingsCard — preenchimento automático pelo CEP", () => {
  it("preenche o endereço no blur do CEP, código IBGE incluído", async () => {
    // O ViaCEP é a única fonte do código IBGE quando a empresa já está
    // configurada e só o endereço muda.
    getSettings.mockResolvedValue({
      configured: true,
      status: "ready",
      cnpj: "50759330000133",
      razaoSocial: "EMPRESA TESTE",
      regimeTributario: 1,
      email: "fiscal@exemplo.com.br",
      endereco: {
        logradouro: "",
        numero: "",
        bairro: "",
        municipio: "",
        codigoIbge: "",
        uf: "",
        cep: "",
      },
      habilitaNfse: true,
      inscricaoMunicipal: "123",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        logradouro: "Rua das Flores",
        bairro: "Centro",
        localidade: "Machado",
        uf: "MG",
        ibge: "3139003",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<FiscalSettingsCard />);
    await esperarCarregar();
    await abrirPassoEndereco();

    await userEvent.type(campo(/^CEP/), "37750000");
    await userEvent.tab();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://viacep.com.br/ws/37750000/json/",
      ),
    );
    await waitFor(() =>
      expect(campo(/Logradouro/)).toHaveValue("Rua das Flores"),
    );
    expect(campo(/Bairro/)).toHaveValue("Centro");
    expect(campo(/Município/)).toHaveValue("Machado");
    expect(campo(/^UF/)).toHaveValue("MG");
    expect(campo(/Código IBGE/)).toHaveValue("3139003");
  });
});
