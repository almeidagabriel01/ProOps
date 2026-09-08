// @vitest-environment jsdom
/**
 * O formulário fiscal em passos.
 *
 * Antes era uma coluna de quatro cards abertos ao mesmo tempo, com um único
 * "Salvar" no fim: quem errasse um campo do primeiro card só descobria depois
 * de rolar a tela toda e receber um toast com a mensagem do backend, sem
 * indicação de QUAL campo. O wizard troca isso por validação no passo que
 * causou o erro — e as regras validadas aqui são as MESMAS do
 * `PUT /v1/fiscal/settings` (CNPJ com dígito verificador, razão social,
 * e-mail, endereço completo com código IBGE, ao menos um tipo de nota,
 * inscrição municipal quando há NFS-e). Divergir do servidor é o risco real
 * desta tela: mais frouxo aqui devolve 400 no fim; mais rígido bloqueia dado
 * que o servidor aceitaria.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { getSettings, saveSettings } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@/services/fiscal-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/fiscal-service")>();
  return {
    ...actual,
    FiscalService: {
      getSettings,
      saveSettings,
      disconnect: vi.fn(),
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
  inscricaoMunicipal: "12345",
  serieNfse: "1",
};

const proximo = () => screen.getByRole("button", { name: /Próximo/ });
const passo = (titulo: RegExp) => screen.findByRole("button", { name: titulo });

async function esperarCarregar(): Promise<void> {
  await waitFor(() => expect(getSettings).toHaveBeenCalled());
  await screen.findByRole("heading", { name: "Dados da empresa" });
}

beforeEach(() => {
  vi.clearAllMocks();
  saveSettings.mockImplementation(async () => CONFIGURADO);
});

describe("FiscalSettingsCard — formulário em passos", () => {
  it("abre no primeiro passo, sem oferecer o salvar do último", async () => {
    getSettings.mockResolvedValue(NAO_CONFIGURADO);
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    // Os quatro passos aparecem na trilha desde o começo — é o que informa o
    // tamanho da tarefa antes de ela começar.
    for (const titulo of [/Empresa/, /Endereço/, /Documentos/, /Certificado/]) {
      expect(await passo(titulo)).toBeInTheDocument();
    }
    expect(proximo()).toBeInTheDocument();
    // O salvar vive só no último passo; passo inativo é aria-hidden.
    expect(screen.queryByRole("button", { name: /Salvar configuração/ })).toBeNull();
  });

  it("não avança com CNPJ de dígito verificador errado", async () => {
    // O servidor recusa este CNPJ com 400. Avisar aqui evita que o erro apareça
    // três passos depois, e diz que o problema é a digitação.
    getSettings.mockResolvedValue(NAO_CONFIGURADO);
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(screen.getByLabelText(/CNPJ/), "12345678901234");
    await userEvent.click(proximo());

    expect(
      await screen.findByText("Os dígitos verificadores não batem"),
    ).toBeInTheDocument();
    // Continua no passo 1 — o endereço não abriu.
    expect(screen.queryByRole("heading", { name: "Endereço do emitente" })).toBeNull();
  });

  it("cobra razão social e e-mail antes de seguir", async () => {
    getSettings.mockResolvedValue(NAO_CONFIGURADO);
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(screen.getByLabelText(/CNPJ/), "50759330000133");
    await userEvent.click(proximo());

    expect(await screen.findByText("Razão social é obrigatória")).toBeInTheDocument();
    expect(screen.getByText("Informe um e-mail válido")).toBeInTheDocument();
  });

  it("avança para o endereço com a empresa completa", async () => {
    getSettings.mockResolvedValue(NAO_CONFIGURADO);
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(screen.getByLabelText(/CNPJ/), "50759330000133");
    await userEvent.type(screen.getByLabelText(/Razão social/), "EMPRESA TESTE");
    await userEvent.type(
      screen.getByLabelText(/E-mail fiscal/),
      "fiscal@exemplo.com.br",
    );
    await userEvent.click(proximo());

    expect(
      await screen.findByRole("heading", { name: "Endereço do emitente" }),
    ).toBeInTheDocument();
  });

  it("exige o endereço completo, código IBGE incluído", async () => {
    // O código IBGE é o campo que ninguém digita: vem da busca de CEP, e sem os
    // 7 dígitos a SEFAZ recusa a nota pelo município.
    getSettings.mockResolvedValue(NAO_CONFIGURADO);
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.type(screen.getByLabelText(/CNPJ/), "50759330000133");
    await userEvent.type(screen.getByLabelText(/Razão social/), "EMPRESA TESTE");
    await userEvent.type(
      screen.getByLabelText(/E-mail fiscal/),
      "fiscal@exemplo.com.br",
    );
    await userEvent.click(proximo());
    await screen.findByRole("heading", { name: "Endereço do emitente" });
    await userEvent.click(proximo());

    expect(await screen.findByText("CEP deve ter 8 dígitos")).toBeInTheDocument();
    expect(screen.getByText("Logradouro é obrigatório")).toBeInTheDocument();
    expect(
      screen.getByText("Deve ter 7 dígitos — confira o CEP"),
    ).toBeInTheDocument();
    // Não passou do endereço.
    expect(
      screen.queryByRole("heading", { name: "Documentos e numeração" }),
    ).toBeNull();
  });

  it("exige inscrição municipal quando a NFS-e está ligada", async () => {
    // Sem ela a prefeitura não tem a quem cobrar o ISS e toda emissão falha lá.
    // O servidor recusa; o passo que liga a NFS-e é onde isso precisa aparecer.
    getSettings.mockResolvedValue({ ...CONFIGURADO, inscricaoMunicipal: "" });
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.click(await passo(/Documentos/));
    await userEvent.click(proximo());

    expect(
      await screen.findByText("Obrigatória para emitir NFS-e"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Certificado digital" }),
    ).toBeNull();
  });

  it("exige ao menos um tipo de nota", async () => {
    getSettings.mockResolvedValue({
      ...CONFIGURADO,
      habilitaNfe: false,
      habilitaNfse: false,
    });
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.click(await passo(/Documentos/));
    await userEvent.click(proximo());

    expect(
      await screen.findByText("Habilite ao menos um tipo de nota (NF-e ou NFS-e)."),
    ).toBeInTheDocument();
  });

  it("quem já configurou pula direto para o certificado e salva", async () => {
    // Em edição a ordem não importa — trocar uma série não deveria exigir
    // reatravessar quatro passos. Em configuração NOVA a sequência importa, e
    // por isso o pular-adiante é ligado só por `configured`.
    getSettings.mockResolvedValue(CONFIGURADO);
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.click(await passo(/Certificado/));
    const salvar = await screen.findByRole("button", {
      name: /Salvar configuração/,
    });
    await userEvent.click(salvar);

    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1));
    expect(saveSettings.mock.calls[0][0]).toMatchObject({
      cnpj: "50759330000133",
      razaoSocial: "EMPRESA TESTE",
      habilitaNfse: true,
    });
  });

  it("conta demo navega os passos, mas nada dentro deles é editável", async () => {
    // O `inert` precisa ficar no CONTEÚDO de cada passo. Num wrapper por cima do
    // wizard (como a page fazia antes) ele mataria também os botões da trilha e
    // do "Próximo", e a conta free ficaria presa no passo 1 — sem erro nenhum.
    getSettings.mockResolvedValue(CONFIGURADO);
    render(<FiscalSettingsCard demoReadOnly />);
    await esperarCarregar();

    expect(screen.getByLabelText(/CNPJ/).closest("[inert]")).not.toBeNull();
    expect(proximo().closest("[inert]")).toBeNull();

    await userEvent.click(proximo());
    expect(
      await screen.findByRole("heading", { name: "Endereço do emitente" }),
    ).toBeInTheDocument();
  });

  it("uma configuração nova não pode pular passos", async () => {
    getSettings.mockResolvedValue(NAO_CONFIGURADO);
    render(<FiscalSettingsCard />);
    await esperarCarregar();

    await userEvent.click(await passo(/Certificado/));

    // O clique não navega: o passo do certificado registra a empresa no
    // provedor a partir do que os passos anteriores gravaram.
    expect(screen.queryByRole("button", { name: /Salvar configuração/ })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Dados da empresa" }),
    ).toBeInTheDocument();
  });
});
