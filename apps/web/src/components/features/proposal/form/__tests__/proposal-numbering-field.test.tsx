// @vitest-environment jsdom
/**
 * Campo da praça e exibição do código na proposta.
 *
 * O que erra em silêncio aqui é o campo APARECER para quem não pediu
 * numeração: o formato é de uma empresa, e o resto da base ganharia uma
 * pergunta a mais no formulário sem nunca ter escolhido isso.
 *
 * O outro é o código virar campo editável numa proposta já criada. Ele é um
 * número de documento; mudar depois de o cliente ter recebido o PDF faria a
 * mesma proposta ter dois identificadores.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import type { ProposalNumberingConfig } from "@/services/proposal-numbering-service";

const useProposalNumbering = vi.fn();

vi.mock("@/hooks/useProposalNumbering", () => ({
  useProposalNumbering: () => useProposalNumbering(),
}));

import { ProposalNumberingField } from "../proposal-numbering-field";

const LIGADA: ProposalNumberingConfig = {
  enabled: true,
  digits: 5,
  resetYearly: false,
  pracas: ["SP", "RJ"],
  defaultPraca: "SP",
  nextNumber: 185,
  year: 2026,
};

function mockConfig(config: ProposalNumberingConfig | null) {
  useProposalNumbering.mockReturnValue({ config, isLoading: false });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProposalNumberingField", () => {
  it("nao aparece para quem nao ligou a numeracao", () => {
    mockConfig({ ...LIGADA, enabled: false });
    const { container } = render(<ProposalNumberingField />);
    expect(container).toBeEmptyDOMElement();
  });

  it("nao aparece quando a numeracao existe sem praca nenhuma", () => {
    // Sem praças o backend monta o código sozinho: não há o que perguntar.
    mockConfig({ ...LIGADA, pracas: [], defaultPraca: null });
    const { container } = render(<ProposalNumberingField />);
    expect(container).toBeEmptyDOMElement();
  });

  it("nao aparece quando a configuracao nao carregou", () => {
    mockConfig(null);
    const { container } = render(<ProposalNumberingField />);
    expect(container).toBeEmptyDOMElement();
  });

  it("oferece as pracas da empresa", () => {
    mockConfig(LIGADA);
    render(<ProposalNumberingField onPracaChange={vi.fn()} />);

    expect(screen.getByLabelText(/Praça/)).toBeInTheDocument();
    for (const sigla of ["SP", "RJ", "Nenhuma"]) {
      expect(
        screen.getByRole("option", { name: sigla }),
      ).toBeInTheDocument();
    }
  });

  it("sugere a praca padrao quando a proposta ainda nao tem uma", () => {
    mockConfig(LIGADA);
    render(<ProposalNumberingField onPracaChange={vi.fn()} />);
    expect(screen.getByLabelText(/Praça/)).toHaveValue("SP");
  });

  it("respeita a praca ja escolhida na proposta", () => {
    mockConfig(LIGADA);
    render(<ProposalNumberingField praca="RJ" onPracaChange={vi.fn()} />);
    expect(screen.getByLabelText(/Praça/)).toHaveValue("RJ");
  });

  it("mostra o codigo como texto, nunca como campo, em proposta ja criada", () => {
    mockConfig(LIGADA);
    render(
      <ProposalNumberingField
        proposalCode="0018526SP"
        praca="SP"
        onPracaChange={vi.fn()}
      />,
    );

    expect(screen.getByText("0018526SP")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Praça/)).toBeNull();
  });

  it("mostra o codigo mesmo com a numeracao desligada depois", () => {
    // Desligar a numeração não pode apagar o identificador de uma proposta que
    // já saiu com ele.
    mockConfig({ ...LIGADA, enabled: false });
    render(<ProposalNumberingField proposalCode="0018526SP" />);
    expect(screen.getByText("0018526SP")).toBeInTheDocument();
  });
});
