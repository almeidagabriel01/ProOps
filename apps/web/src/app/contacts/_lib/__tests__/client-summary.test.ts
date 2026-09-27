import { describe, expect, it } from "vitest";
import type { Proposal } from "@/types/proposal";
import type { Transaction } from "@/services/transaction-service";
import { summarizeFinance, summarizeProposals } from "../client-summary";

const p = (status: string, value = 1000, closedValue?: number) =>
  ({ id: status + value, status, totalValue: value, closedValue }) as unknown as Proposal;

describe("summarizeProposals", () => {
  it("conta aprovadas, abertas e o valor fechado, ignorando rascunho", () => {
    const summary = summarizeProposals(
      [p("approved", 1000, 900), p("sent", 500), p("rejected"), p("draft"), p("col-ganha", 300)],
      (proposal) => proposal.status === "approved" || proposal.status === "col-ganha",
    );
    expect(summary).toEqual({ total: 4, approved: 2, approvedValue: 1200, open: 1 });
  });
});

describe("summarizeFinance", () => {
  const t = (type: string, status: string, amount: number) =>
    ({ type, status, amount }) as unknown as Transaction;

  it("soma só receitas: recebido, a receber e vencido", () => {
    expect(
      summarizeFinance([
        t("income", "paid", 100),
        t("income", "pending", 50),
        t("income", "overdue", 30),
        t("expense", "paid", 999),
      ]),
    ).toEqual({ received: 100, toReceive: 80, overdue: 30 });
  });
});
