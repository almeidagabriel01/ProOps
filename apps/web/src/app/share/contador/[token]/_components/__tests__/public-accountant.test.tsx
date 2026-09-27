// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  overview: vi.fn(),
  dre: vi.fn(),
  transactions: vi.fn(),
  invoices: vi.fn(),
  received: vi.fn(),
}));

vi.mock("@/services/accountant-service", () => ({
  AccountantService: {
    overview: (...a: unknown[]) => m.overview(...a),
    dre: (...a: unknown[]) => m.dre(...a),
    transactions: (...a: unknown[]) => m.transactions(...a),
    invoices: (...a: unknown[]) => m.invoices(...a),
    received: (...a: unknown[]) => m.received(...a),
    documentUrl: (token: string, source: string, id: string, kind: string) =>
      `/api/backend/v1/share/accountant/${token}/documents/${source}/${id}?kind=${kind}`,
  },
}));
vi.mock("@/lib/export/sheet", async (orig) => ({ ...(await orig<object>()), downloadSheet: vi.fn() }));

import { PublicAccountant } from "../public-accountant";
import { exampleDre } from "@/lib/accountant/example";

const TOKEN = "tok_abcdefghijklmnop";

beforeEach(() => {
  vi.clearAllMocks();
  m.overview.mockResolvedValue({
    company: { name: "Casa Viva", logoUrl: null, primaryColor: null },
    sections: { dre: true, transactions: true, invoices: true, received: false },
  });
  m.dre.mockResolvedValue(exampleDre(["2026-08"]));
  m.transactions.mockResolvedValue({
    transactions: [
      { id: "t1", description: "Aluguel", type: "expense", status: "paid", date: "2026-08-05", dueDate: "2026-08-05", paidAt: "2026-08-05", amount: 4800, extraCosts: 0, category: "Aluguel", contact: null, wallet: "Conta", installment: null },
    ],
    truncated: false,
  });
  m.invoices.mockResolvedValue({
    invoices: [
      { id: "n1", type: "nfse", number: "58", series: "1", status: "authorized", amount: 1000, contact: "Ana", issuedAt: "2026-08-04", cancelledAt: null, hasPdf: true, hasXml: true },
    ],
  });
});

describe("link do contador", () => {
  it("abre no mês passado, com o DRE da empresa em caixa", async () => {
    render(<PublicAccountant token={TOKEN} />);
    expect(await screen.findByText("Casa Viva")).toBeInTheDocument();
    await waitFor(() => expect(m.dre).toHaveBeenCalled());
    const [token, params] = m.dre.mock.calls[0];
    expect(token).toBe(TOKEN);
    expect(params.basis).toBe("cash");
    expect(params.from).toBe(params.to);
    expect(await screen.findByText("= Resultado do período")).toBeInTheDocument();
  });

  it("as abas seguem o plano: sem recepção de notas, sem a aba de entrada", async () => {
    render(<PublicAccountant token={TOKEN} />);
    await screen.findByText("Casa Viva");
    expect(screen.getByRole("tab", { name: "Notas emitidas" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Notas de entrada" })).toBeNull();
  });

  it("lançamentos com a despesa em negativo", async () => {
    render(<PublicAccountant token={TOKEN} />);
    await userEvent.click(await screen.findByRole("tab", { name: "Lançamentos" }));
    expect(await screen.findByText("Aluguel", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/-R\$\s*4\.800,00/)).toBeInTheDocument();
  });

  it("nota com PDF e XML pelo endereço de download, com o tipo na query", async () => {
    render(<PublicAccountant token={TOKEN} />);
    await userEvent.click(await screen.findByRole("tab", { name: "Notas emitidas" }));
    const pdf = await screen.findByRole("link", { name: "PDF" });
    expect(pdf.getAttribute("href")).toMatch(/\/documents\/invoice\/n1\?kind=pdf$/);
    expect(screen.getByRole("link", { name: "XML" }).getAttribute("href")).toMatch(/\?kind=xml$/);
  });

  it("link desligado", async () => {
    m.overview.mockRejectedValue(Object.assign(new Error("404"), { status: 404 }));
    render(<PublicAccountant token={TOKEN} />);
    expect(await screen.findByText("Link indisponível")).toBeInTheDocument();
  });

  it("o exemplo da demonstração não chama a API e não tem link de arquivo", async () => {
    render(<PublicAccountant token="exemplo" />);
    expect(await screen.findByText(/Este é um exemplo, com dados fictícios/)).toBeInTheDocument();
    expect(await screen.findByText("= Resultado do período")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Notas emitidas" }));
    expect(await screen.findAllByText("PDF")).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "PDF" })).toBeNull();
    expect(m.overview).not.toHaveBeenCalled();
    expect(m.dre).not.toHaveBeenCalled();
  });
});
