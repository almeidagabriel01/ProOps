// @vitest-environment jsdom
/**
 * Comissões da proposta.
 *
 * O que erra em silêncio aqui:
 *
 * 1. **Oferecer contato que não é parceiro.** A lista tem que sair filtrada por
 *    vendedor/arquiteto; um cliente comum ali viraria uma despesa de comissão
 *    para quem comprou.
 * 2. **Percentual virar referência ao cadastro.** Ele é COPIADO ao adicionar.
 *    Mudar a comissão padrão do contato depois não pode reescrever o que já foi
 *    combinado nesta proposta.
 * 3. **O mesmo parceiro entrar duas vezes**, que dobraria a comissão dele.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { getClients } = vi.hoisted(() => ({ getClients: vi.fn() }));

vi.mock("@/services/client-service", () => ({
  ClientService: { getClients },
}));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ tenant: { id: "t1" } }),
}));

import { ProposalCommissionsSection } from "../proposal-commissions-section";
import type { ProposalCommission } from "@/types/proposal";

const PARTNERS = [
  {
    id: "arq1",
    name: "Ana Souza",
    types: ["arquiteto"],
    commissionPercentage: 10,
  },
  {
    id: "ven1",
    name: "Bruno Lima",
    types: ["vendedor"],
    commissionPercentage: 2.5,
  },
  { id: "cli1", name: "Cliente Final", types: ["cliente"] },
  { id: "for1", name: "Fornecedor SA", types: ["fornecedor"] },
];

/** Abre a lista do SearchableSelect e devolve os botões de opção. */
async function openPartnerList() {
  await waitFor(() =>
    expect(screen.getByLabelText("Abrir opções")).toBeInTheDocument(),
  );
  await userEvent.click(screen.getByLabelText("Abrir opções"));
}

function setup(commissions: ProposalCommission[] = [], totalValue = 100000) {
  const onChange = vi.fn();
  render(
    <ProposalCommissionsSection
      commissions={commissions}
      onChange={onChange}
      totalValue={totalValue}
    />,
  );
  return { onChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  getClients.mockResolvedValue(PARTNERS);
});

describe("ProposalCommissionsSection", () => {
  it("só oferece vendedor e arquiteto", async () => {
    setup();
    await openPartnerList();

    expect(
      screen.getByRole("button", { name: /Ana Souza/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Bruno Lima/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cliente Final/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Fornecedor SA/ })).toBeNull();
  });

  it("copia o percentual do cadastro ao adicionar", async () => {
    const { onChange } = setup();
    await openPartnerList();
    await userEvent.click(screen.getByRole("button", { name: /Ana Souza/ }));

    expect(onChange).toHaveBeenCalledWith([
      {
        contactId: "arq1",
        contactName: "Ana Souza",
        role: "arquiteto",
        percentage: 10,
      },
    ]);
  });

  it("mostra o valor em reais ao lado do percentual", async () => {
    setup([
      {
        contactId: "arq1",
        contactName: "Ana Souza",
        role: "arquiteto",
        percentage: 10,
      },
    ]);

    // Aparece duas vezes: na linha do parceiro e no total.
    expect(await screen.findAllByText(/10\.000,00/)).toHaveLength(2);
  });

  it("soma o total das comissões", async () => {
    setup([
      {
        contactId: "arq1",
        contactName: "Ana Souza",
        role: "arquiteto",
        percentage: 10,
      },
      {
        contactId: "ven1",
        contactName: "Bruno Lima",
        role: "vendedor",
        percentage: 2.5,
      },
    ]);

    expect(screen.getByText("Total de comissões")).toBeInTheDocument();
    expect(await screen.findByText(/12\.500,00/)).toBeInTheDocument();
  });

  it("não oferece de novo um parceiro já adicionado", async () => {
    setup([
      {
        contactId: "arq1",
        contactName: "Ana Souza",
        role: "arquiteto",
        percentage: 10,
      },
    ]);
    await openPartnerList();

    expect(
      screen.getByRole("button", { name: /Bruno Lima/ }),
    ).toBeInTheDocument();
    // O nome de Ana continua no botão de remover ("Remover comissão de Ana
    // Souza"), então a busca ancora no início do nome acessível: a opção da
    // lista começa pelo nome dela.
    expect(screen.queryByRole("button", { name: /^Ana Souza/ })).toBeNull();
  });

  it("remover tira a comissão da lista", async () => {
    const { onChange } = setup([
      {
        contactId: "arq1",
        contactName: "Ana Souza",
        role: "arquiteto",
        percentage: 10,
      },
    ]);

    await userEvent.click(
      screen.getByLabelText("Remover comissão de Ana Souza"),
    );
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("editar o percentual não mexe nas outras comissões", async () => {
    const { onChange } = setup([
      {
        contactId: "arq1",
        contactName: "Ana Souza",
        role: "arquiteto",
        percentage: 10,
      },
      {
        contactId: "ven1",
        contactName: "Bruno Lima",
        role: "vendedor",
        percentage: 2.5,
      },
    ]);

    const input = screen.getByLabelText(
      "Percentual de comissão de Bruno Lima",
    );
    await userEvent.clear(input);
    await userEvent.type(input, "3");

    const last = onChange.mock.calls.at(-1)?.[0] as ProposalCommission[];
    expect(last[0].percentage).toBe(10);
    expect(last[1].contactId).toBe("ven1");
  });

  it("avisa quando não há nenhum parceiro cadastrado", async () => {
    getClients.mockResolvedValue([PARTNERS[2]]);
    setup();
    expect(
      await screen.findByText(/Nenhum contato marcado como vendedor/),
    ).toBeInTheDocument();
  });

  it("em modo demonstração não deixa remover", async () => {
    render(
      <ProposalCommissionsSection
        commissions={[
          {
            contactId: "arq1",
            contactName: "Ana Souza",
            role: "arquiteto",
            percentage: 10,
          },
        ]}
        onChange={vi.fn()}
        totalValue={100000}
        isReadOnly
      />,
    );
    expect(screen.queryByLabelText(/Remover comissão/)).toBeNull();
    expect(screen.queryByLabelText("Abrir opções")).toBeNull();
  });
});
