// @vitest-environment jsdom
/**
 * "Responsável pela venda": quem da equipe cuida da proposta. Vale em todos os
 * planos (vem do responsável do cliente); nos planos com metas também conta na
 * meta da pessoa.
 */
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ plan: { hasSalesGoals: true } }));

vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));

import { ProposalSellerField } from "../proposal-seller-field";

const people = [
  { id: "eu", name: "Eu" },
  { id: "beto", name: "Beto" },
];

beforeEach(() => {
  m.plan = { hasSalesGoals: true };
});

describe("responsável pela venda", () => {
  it("proposta nova mostra quem cria como responsável", () => {
    render(<ProposalSellerField value={undefined} currentUserId="eu" people={people} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Responsável pela venda")).toHaveValue("eu");
  });

  it("não se chama 'Vendedor', que é o nome da comissão no passo de pagamento", () => {
    render(<ProposalSellerField value={undefined} currentUserId="eu" people={people} onChange={vi.fn()} />);
    expect(screen.queryByText("Vendedor")).toBeNull();
    expect(screen.getByText(/Não é a\s+comissão/)).toBeInTheDocument();
  });

  it("proposta antiga sem responsável mostra 'Sem responsável'", () => {
    render(<ProposalSellerField value={null} currentUserId="eu" people={people} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Responsável pela venda")).toHaveValue("");
  });

  it("trocar o responsável avisa o formulário", async () => {
    const onChange = vi.fn();
    render(<ProposalSellerField value={undefined} currentUserId="eu" people={people} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Responsável pela venda"), "beto");
    expect(onChange).toHaveBeenCalledWith("beto");
  });

  it("sem o plano de metas o campo aparece, sem falar de meta", () => {
    m.plan = { hasSalesGoals: false };
    render(<ProposalSellerField value={undefined} currentUserId="eu" people={people} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Responsável pela venda")).toHaveValue("eu");
    expect(screen.getByText("Quem da equipe cuida desta venda.")).toBeInTheDocument();
    expect(screen.queryByText(/meta/)).toBeNull();
  });

  it("enquanto a equipe carrega, o campo existe desabilitado ao lado do Endereço", () => {
    render(<ProposalSellerField value={undefined} currentUserId="eu" people={[]} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Responsável pela venda")).toBeDisabled();
  });
});
