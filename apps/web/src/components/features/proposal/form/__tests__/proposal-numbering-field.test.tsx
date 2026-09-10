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
 *
 * `hasProposalNumbering` tem teste próprio porque a SEÇÃO usa a mesma resposta
 * para escolher o número de colunas do grid. Quando as duas discordavam, a
 * praça caía sozinha numa quarta célula com dois terços de linha vazia ao lado.
 */

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { ProposalNumberingConfig } from "@/services/proposal-numbering-service";
import {
  ProposalNumberingField,
  hasProposalNumbering,
} from "../proposal-numbering-field";

const LIGADA: ProposalNumberingConfig = {
  enabled: true,
  digits: 5,
  resetYearly: false,
  pracas: ["SP", "RJ"],
  defaultPraca: "SP",
  nextNumber: 185,
  year: 2026,
};

describe("hasProposalNumbering", () => {
  it("e falso para quem nao ligou a numeracao", () => {
    expect(hasProposalNumbering({ ...LIGADA, enabled: false })).toBe(false);
  });

  it("e falso quando a numeracao existe sem praca nenhuma", () => {
    // Sem praças o backend monta o código sozinho: não há o que perguntar.
    expect(
      hasProposalNumbering({ ...LIGADA, pracas: [], defaultPraca: null }),
    ).toBe(false);
  });

  it("e falso quando a configuracao nao carregou", () => {
    expect(hasProposalNumbering(null)).toBe(false);
  });

  it("e verdadeiro com numeracao e pracas", () => {
    expect(hasProposalNumbering(LIGADA)).toBe(true);
  });

  it("e falso numa proposta que ja existe e nao tem codigo", () => {
    // Proposta criada antes de a numeracao ser ligada. Oferecer a praca ali
    // seria pior que nao oferecer nada: `proposalPraca` esta fora da allowlist
    // do PUT, entao a escolha seria aceita na tela e descartada no servidor.
    expect(hasProposalNumbering(LIGADA, null, false)).toBe(false);
  });

  it("e verdadeiro para proposta que ja tem codigo, mesmo sem config", () => {
    // Desligar a numeração não pode esconder o identificador de uma proposta
    // que já saiu com ele.
    expect(hasProposalNumbering(null, "0018526SP")).toBe(true);
    expect(
      hasProposalNumbering({ ...LIGADA, enabled: false }, "0018526SP"),
    ).toBe(true);
  });
});

describe("ProposalNumberingField", () => {
  it("nao renderiza nada para quem nao ligou a numeracao", () => {
    const { container } = render(
      <ProposalNumberingField config={{ ...LIGADA, enabled: false }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("nao renderiza nada quando a numeracao existe sem praca", () => {
    const { container } = render(
      <ProposalNumberingField
        config={{ ...LIGADA, pracas: [], defaultPraca: null }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("nao renderiza nada enquanto a configuracao nao carregou", () => {
    const { container } = render(<ProposalNumberingField config={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("oferece as pracas da empresa", () => {
    render(
      <ProposalNumberingField config={LIGADA} onPracaChange={vi.fn()} />,
    );

    expect(screen.getByLabelText(/Praça/)).toBeInTheDocument();
    for (const sigla of ["SP", "RJ", "Nenhuma"]) {
      expect(screen.getByRole("option", { name: sigla })).toBeInTheDocument();
    }
  });

  it("sugere a praca padrao quando a proposta ainda nao tem uma", () => {
    render(
      <ProposalNumberingField config={LIGADA} onPracaChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Praça/)).toHaveValue("SP");
  });

  it("respeita a praca ja escolhida na proposta", () => {
    render(
      <ProposalNumberingField
        config={LIGADA}
        praca="RJ"
        onPracaChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Praça/)).toHaveValue("RJ");
  });

  it("mostra o codigo como texto, nunca como campo, em proposta ja criada", () => {
    render(
      <ProposalNumberingField
        config={LIGADA}
        proposalCode="0018526SP"
        praca="SP"
        onPracaChange={vi.fn()}
      />,
    );

    expect(screen.getByText("0018526SP")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Praça/)).toBeNull();
  });

  it("nao oferece praca em proposta que ja existe sem codigo", () => {
    const { container } = render(
      <ProposalNumberingField
        config={LIGADA}
        canChoosePraca={false}
        onPracaChange={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o codigo em proposta que ja existe, sem virar campo", () => {
    // O caso do dia a dia: abrir para editar uma proposta ja numerada.
    render(
      <ProposalNumberingField
        config={LIGADA}
        proposalCode="0000126SP"
        praca="SP"
        canChoosePraca={false}
        onPracaChange={vi.fn()}
      />,
    );

    expect(screen.getByText("0000126SP")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Praça/)).toBeNull();
  });

  it("mostra o codigo mesmo com a numeracao desligada depois", () => {
    render(
      <ProposalNumberingField
        config={{ ...LIGADA, enabled: false }}
        proposalCode="0018526SP"
      />,
    );
    expect(screen.getByText("0018526SP")).toBeInTheDocument();
  });
});
