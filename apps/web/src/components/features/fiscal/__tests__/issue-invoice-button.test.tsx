// @vitest-environment jsdom
/**
 * "Emitir NF" na proposta abre a revisão da nota em vez de emitir no clique.
 *
 * A nota saía direto do botão, sem dar para informar IPI, transporte ou mudar
 * a observação, e um cliente que precisava disso emitia em outro sistema. O
 * aviso de nota repetida foi junto para a página de revisão.
 */

import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  push: vi.fn(),
  previewFromProposal: vi.fn(),
  issueFromProposal: vi.fn(),
  issueFromTransaction: vi.fn(async () => ({ invoices: [{ id: "i1" }] })),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock("@/services/fiscal-service", () => ({
  FiscalService: {
    previewFromProposal: m.previewFromProposal,
    issueFromProposal: m.issueFromProposal,
    issueFromTransaction: m.issueFromTransaction,
  },
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    data?: unknown;
  },
  callApi: vi.fn(),
}));

import { IssueInvoiceButton } from "../issue-invoice-button";

beforeEach(() => vi.clearAllMocks());

describe("IssueInvoiceButton", () => {
  it("na proposta abre a revisão da nota, sem emitir nem consultar", async () => {
    render(<IssueInvoiceButton source="proposal" sourceId="p 1" />);
    await userEvent.click(screen.getByRole("button", { name: /Emitir NF/i }));

    expect(m.push).toHaveBeenCalledWith("/invoices/new?proposal=p%201");
    expect(m.issueFromProposal).not.toHaveBeenCalled();
    expect(m.previewFromProposal).not.toHaveBeenCalled();
  });

  it("no lançamento a emissão continua direta", async () => {
    render(<IssueInvoiceButton source="transaction" sourceId="t1" />);
    await userEvent.click(screen.getByRole("button", { name: /Emitir NF/i }));

    expect(m.issueFromTransaction).toHaveBeenCalledWith("t1");
    expect(m.push).not.toHaveBeenCalled();
  });
});
