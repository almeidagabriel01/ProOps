// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  plan: { hasSalesGoals: true },
  sellers: vi.fn(),
}));

vi.mock("@/hooks/usePlanLimits", () => ({ usePlanLimits: () => m.plan }));
vi.mock("@/services/sales-goals-service", () => ({
  SalesGoalsService: { sellers: (...a: unknown[]) => m.sellers(...a) },
}));

import { ProposalSellerField } from "../proposal-seller-field";

beforeEach(() => {
  vi.clearAllMocks();
  m.plan = { hasSalesGoals: true };
  m.sellers.mockResolvedValue([
    { id: "eu", name: "Eu" },
    { id: "beto", name: "Beto" },
  ]);
});

describe("vendedor da proposta", () => {
  it("proposta nova mostra quem cria como responsável pela venda", async () => {
    render(<ProposalSellerField value={undefined} currentUserId="eu" onChange={vi.fn()} />);
    expect(await screen.findByLabelText("Responsável pela venda")).toHaveValue("eu");
  });

  it("não se chama 'Vendedor', que é o nome da comissão no passo de pagamento", async () => {
    render(<ProposalSellerField value={undefined} currentUserId="eu" onChange={vi.fn()} />);
    await screen.findByLabelText("Responsável pela venda");
    expect(screen.queryByText("Vendedor")).toBeNull();
    expect(screen.getByText(/Não é a\s+comissão/)).toBeInTheDocument();
  });

  it("proposta antiga sem responsável mostra 'Sem responsável'", async () => {
    render(<ProposalSellerField value={null} currentUserId="eu" onChange={vi.fn()} />);
    expect(await screen.findByLabelText("Responsável pela venda")).toHaveValue("");
  });

  it("trocar o vendedor avisa o formulário", async () => {
    const onChange = vi.fn();
    render(<ProposalSellerField value={undefined} currentUserId="eu" onChange={onChange} />);
    await userEvent.selectOptions(await screen.findByLabelText("Responsável pela venda"), "beto");
    expect(onChange).toHaveBeenCalledWith("beto");
  });

  it("sem o plano de metas, o campo não aparece nem busca a equipe", () => {
    m.plan = { hasSalesGoals: false };
    const { container } = render(<ProposalSellerField value={undefined} currentUserId="eu" onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(m.sellers).not.toHaveBeenCalled();
  });
});

it("enquanto a equipe carrega, o campo existe desabilitado ao lado do Endereço", async () => {
  let resolve!: (v: unknown) => void;
  m.sellers.mockReturnValue(new Promise((r) => (resolve = r)));
  render(<ProposalSellerField value={undefined} currentUserId="eu" onChange={vi.fn()} />);
  expect(screen.getByLabelText("Responsável pela venda")).toBeDisabled();
  resolve([{ id: "eu", name: "Eu" }]);
  await vi.waitFor(() => expect(screen.getByLabelText("Responsável pela venda")).not.toBeDisabled());
});
