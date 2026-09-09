// @vitest-environment jsdom
/**
 * Lançar a nota do fornecedor como despesa.
 *
 * O risco não é falhar — é duplicar. Quem compra costuma já ter lançado a
 * compra à mão quando pagou, e um segundo lançamento é o saldo da carteira
 * errado, que só aparece na conciliação semanas depois.
 */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { launch, ApiErrorMock } = vi.hoisted(() => {
  class ApiErrorMock extends Error {
    data?: unknown;
    constructor(message: string, data?: unknown) {
      super(message);
      this.data = data;
    }
  }
  return { launch: vi.fn(), ApiErrorMock };
});

vi.mock("@/services/received-invoice-service", () => ({
  ReceivedInvoiceService: { launch },
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/api-client", () => ({ ApiError: ApiErrorMock, callApi: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { LaunchReceivedInvoiceButton } from "../launch-received-invoice-button";
import type { ReceivedInvoice } from "@/services/received-invoice-service";

const NOTA = {
  id: "r1",
  tenantId: "t1",
  chaveAcesso: "1".repeat(44),
  versao: 1,
  status: "completa",
  emitenteCnpj: "11222333000181",
  emitenteNome: "Fornecedor Alfa",
  valorTotal: 1500,
  createdAt: "",
  updatedAt: "",
} as ReceivedInvoice;

const CANDIDATOS = [
  { id: "tx-1", description: "Material de obra", amount: 1500, date: "2026-09-05" },
];

function renderButton(invoice: ReceivedInvoice = NOTA, onLaunched = vi.fn()) {
  render(<LaunchReceivedInvoiceButton invoice={invoice} onLaunched={onLaunched} />);
  return onLaunched;
}

beforeEach(() => {
  vi.clearAllMocks();
  launch.mockResolvedValue({
    outcome: "created",
    invoice: { ...NOTA, transactionId: "tx-novo" },
    transactionId: "tx-novo",
  });
});

describe("LaunchReceivedInvoiceButton", () => {
  it("lança direto quando não há despesa parecida", async () => {
    const onLaunched = renderButton();

    await userEvent.click(screen.getByRole("button", { name: /Lançar/ }));

    expect(launch).toHaveBeenCalledWith("1".repeat(44), { force: false });
    expect(onLaunched).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: "tx-novo" }),
    );
  });

  it("avisa em vez de lançar quando o backend acha despesa parecida", async () => {
    launch.mockRejectedValueOnce(
      new ApiErrorMock("conflito", {
        code: "LANCAMENTO_POSSIVEL_DUPLICADO",
        candidates: CANDIDATOS,
      }),
    );
    const onLaunched = renderButton();

    await userEvent.click(screen.getByRole("button", { name: /Lançar/ }));

    expect(screen.getByText("Já existe despesa parecida")).toBeInTheDocument();
    // Mostra QUAL despesa: "existe algo parecido" sem dizer o quê não deixa
    // ninguém decidir.
    expect(screen.getByText("Material de obra")).toBeInTheDocument();
    expect(onLaunched).not.toHaveBeenCalled();
  });

  it("prossegue com force quando o usuário confirma", async () => {
    launch.mockRejectedValueOnce(
      new ApiErrorMock("conflito", {
        code: "LANCAMENTO_POSSIVEL_DUPLICADO",
        candidates: CANDIDATOS,
      }),
    );
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: /^Lançar$/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Lançar mesmo assim" }),
    );

    expect(launch).toHaveBeenLastCalledWith("1".repeat(44), { force: true });
  });

  it("cancelar no aviso não lança nada", async () => {
    launch.mockRejectedValueOnce(
      new ApiErrorMock("conflito", {
        code: "LANCAMENTO_POSSIVEL_DUPLICADO",
        candidates: CANDIDATOS,
      }),
    );
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: /^Lançar$/ }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(launch).toHaveBeenCalledTimes(1);
  });

  it("nota já lançada vira atalho para a despesa, não some", async () => {
    // Sumir seria a pessoa procurando onde o lançamento foi parar.
    renderButton({ ...NOTA, transactionId: "tx-antigo" });

    const link = screen.getByRole("link", { name: /Lançada/ });
    expect(link).toHaveAttribute("href", "/transactions/tx-antigo");
    expect(screen.queryByRole("button", { name: /^Lançar$/ })).toBeNull();
  });

  it("reconhece o caso de a nota já ter lançamento no servidor", async () => {
    // Dois usuários na mesma tela: o segundo recebe o id existente.
    launch.mockResolvedValue({
      outcome: "already_launched",
      transactionId: "tx-outro",
    });
    const onLaunched = renderButton();

    await userEvent.click(screen.getByRole("button", { name: /Lançar/ }));

    expect(onLaunched).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: "tx-outro" }),
    );
  });
});
