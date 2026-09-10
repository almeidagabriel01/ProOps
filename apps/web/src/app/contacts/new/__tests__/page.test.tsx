// @vitest-environment jsdom
/**
 * O cadastro de contato precisa pedir os DADOS FISCAIS.
 *
 * Até 2026-09-09 o endereço fiscal só existia em `/contacts/[id]`: quem
 * cadastrava um cliente para faturar salvava, voltava para a lista e reabria o
 * mesmo contato para achar o campo que a NF-e exige do destinatário. A falha é
 * silenciosa — nada avisa que o passo não existe nesta tela; a conta só chega
 * na hora de emitir, com `fiscal-readiness` acusando lacuna no cliente.
 *
 * O guard de estrutura (`step-wizard-children-parity`) não pega isto: lá o que
 * se conta é card contra passo DENTRO de um wizard, e as duas telas estavam
 * internamente coerentes, só que com trilhas diferentes.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const createClient = vi.fn().mockResolvedValue({ success: true, clientId: "c1" });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1" } }),
}));

vi.mock("@/hooks/usePagePermission", () => ({
  usePagePermission: () => ({ canCreate: true, isLoading: false }),
}));

vi.mock("@/hooks/usePlanLimits", () => ({
  usePlanLimits: () => ({
    canCreateClient: vi.fn().mockResolvedValue(true),
    getClientCount: vi.fn().mockResolvedValue(0),
    features: { maxClients: 10 },
  }),
}));

vi.mock("@/hooks/useClientActions", () => ({
  useClientActions: () => ({ createClient, isLoading: false }),
}));

// O modal de limite lê tema e assinatura; aqui ele nunca abre.
vi.mock("@/components/ui/limit-reached-modal", () => ({
  LimitReachedModal: () => null,
}));

import NewCustomerPage from "../page";

/**
 * O `StepWizard` mantém TODOS os passos montados e esconde os inativos por CSS;
 * como o jsdom não aplica CSS, há um "Próximo" por passo no DOM. Avançar é
 * clicar sempre o primeiro: `nextStep()` anda a partir do passo atual do
 * contexto, não do botão clicado.
 */
async function avancar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole("button", { name: /próximo/i })[0]);
}

async function preencherObrigatoriosEAvancar() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Nome Completo/), "Cliente Teste");
  await user.type(screen.getByLabelText(/Telefone/), "11999999999");
  await avancar(user);
  return user;
}

describe("/contacts/new", () => {
  beforeEach(() => {
    push.mockClear();
    createClient.mockClear();
  });

  it("tem a mesma trilha da edição: Informações, Dados Fiscais e Finalizar", () => {
    render(<NewCustomerPage />);

    for (const passo of ["Informações", "Dados Fiscais", "Finalizar"]) {
      expect(screen.getByRole("button", { name: new RegExp(passo) })).toBeInTheDocument();
    }
  });

  it("pede endereço e documento junto do contato, no passo 1", () => {
    render(<NewCustomerPage />);

    expect(screen.getByLabelText("Endereço Completo")).toBeInTheDocument();
    expect(screen.getByLabelText(/CPF ou CNPJ/)).toBeInTheDocument();
  });

  it("pede o endereço fiscal no passo de dados fiscais", async () => {
    render(<NewCustomerPage />);
    await preencherObrigatoriosEAvancar();

    expect(
      screen.getByRole("heading", { level: 3, name: "Dados fiscais" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("CEP")).toBeInTheDocument();
    expect(screen.getByLabelText("Código IBGE do município")).toBeInTheDocument();
  });

  it("mostra a comissão do parceiro no passo 1, junto do documento", async () => {
    render(<NewCustomerPage />);
    const user = userEvent.setup();

    // Cliente não recebe comissão, e "Cliente" é o tipo pré-selecionado.
    expect(screen.queryByLabelText(/Comissão padrão/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /Vendedor/ }));

    // No passo 1, ao lado do CPF/CNPJ: marcar "Vendedor" e o campo aparecer na
    // mesma tela é o que faltava quando ele vivia no passo dos dados fiscais,
    // onde a trilha do celular mostra só o título e ninguém o encontrava.
    const comissao = screen.getByLabelText(/Comissão padrão/);
    expect(comissao).toBeInTheDocument();
    expect(screen.getByLabelText(/CPF ou CNPJ/).closest("div.grid")).toBe(
      comissao.closest("div.grid"),
    );
  });

  it("o passo de dados fiscais fica só com os campos da nota", async () => {
    render(<NewCustomerPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Vendedor/ }));
    await user.type(screen.getByLabelText(/Nome Completo/), "Parceiro");
    await user.type(screen.getByLabelText(/Telefone/), "11999999999");
    await avancar(user);

    expect(
      screen.getByRole("heading", { level: 3, name: "Dados fiscais" }),
    ).toBeInTheDocument();
    // A comissão não é dado fiscal: não entra em campo nenhum da NF-e.
    expect(
      screen.queryByRole("heading", { level: 3, name: "Comissão" }),
    ).toBeNull();
  });

  it("envia o endereço fiscal no cadastro", async () => {
    render(<NewCustomerPage />);
    const user = await preencherObrigatoriosEAvancar();

    await user.type(screen.getByLabelText("Logradouro"), "Rua das Flores");
    await user.type(screen.getByLabelText("Número"), "100");
    await user.type(screen.getByLabelText("Município"), "Machado");
    await user.type(screen.getByLabelText("UF"), "mg");
    await user.type(screen.getByLabelText("Código IBGE do município"), "3139102");

    await avancar(user);
    await user.click(screen.getByRole("button", { name: /cadastrar cliente/i }));

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0][0]).toMatchObject({
      name: "Cliente Teste",
      enderecoFiscal: {
        logradouro: "Rua das Flores",
        numero: "100",
        municipio: "Machado",
        uf: "MG",
        codigoIbge: "3139102",
      },
    });
  });

  it("não manda indicador de IE vazio: o backend o deriva do documento", async () => {
    render(<NewCustomerPage />);
    const user = await preencherObrigatoriosEAvancar();

    await avancar(user);
    await user.click(screen.getByRole("button", { name: /cadastrar cliente/i }));

    // String vazia seria recusada pelo enum do schema do backend, derrubando o
    // cadastro inteiro por um campo que ninguém preencheu.
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient.mock.calls[0][0]).not.toHaveProperty("indicadorIe");
  });

  it("completa o endereço livre a partir do fiscal, letra a letra", async () => {
    // O campo livre acompanha o fiscal enquanto ninguém escreveu nele à mão.
    // Enquanto a condição era só "está vazio", ele congelava na primeira tecla
    // do logradouro e o cadastro terminava com "R" de endereço.
    render(<NewCustomerPage />);
    const user = await preencherObrigatoriosEAvancar();

    await user.type(screen.getByLabelText("Logradouro"), "Rua das Flores");
    await user.type(screen.getByLabelText("Número"), "100");

    const livre = screen.getByLabelText("Endereço Completo") as HTMLInputElement;
    expect(livre.value).toBe("Rua das Flores, 100");
  });

  it("envia a comissão do parceiro", async () => {
    render(<NewCustomerPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /Arquiteto/ }));
    await user.type(screen.getByLabelText(/Comissão padrão/), "7.5");
    await user.type(screen.getByLabelText(/Nome Completo/), "Cliente Teste");
    await user.type(screen.getByLabelText(/Telefone/), "11999999999");

    await avancar(user);
    await avancar(user);
    await user.click(screen.getByRole("button", { name: /cadastrar cliente/i }));

    expect(createClient.mock.calls[0][0]).toMatchObject({
      types: ["cliente", "arquiteto"],
      commissionPercentage: 7.5,
    });
  });

  it("não sobrescreve o endereço escrito à mão", async () => {
    render(<NewCustomerPage />);
    const user = await preencherObrigatoriosEAvancar();

    const livre = screen.getByLabelText("Endereço Completo") as HTMLInputElement;
    await user.type(livre, "Rua tal, portão azul");
    await user.type(screen.getByLabelText("Logradouro"), "Rua das Flores");

    expect(livre.value).toBe("Rua tal, portão azul");
  });
});
