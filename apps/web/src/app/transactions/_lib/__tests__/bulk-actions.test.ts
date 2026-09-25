import { describe, expect, it } from "vitest";
import type { Transaction } from "@/services/transaction-service";
import {
  STATUS_BATCH_MAX_IDS,
  buildExportRows,
  planBulkDelete,
  planBulkMarkPaid,
  resolveSelectedTransactions,
} from "../bulk-actions";

const tx = (id: string, extra: Partial<Transaction> = {}): Transaction =>
  ({
    id,
    tenantId: "t1",
    type: "income",
    description: `Lançamento ${id}`,
    amount: 100,
    date: "2026-09-01",
    status: "pending",
    createdAt: "",
    updatedAt: "",
    ...extra,
  }) as Transaction;

describe("resolveSelectedTransactions", () => {
  it("devolve só os lançamentos selecionados, sem repetir e sem custo extra", () => {
    const pool = [tx("a"), tx("b"), tx("a")];
    const result = resolveSelectedTransactions(pool, new Set(["a", "ec-1"]));
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("planBulkMarkPaid", () => {
  it("ignora os já pagos", () => {
    const chunks = planBulkMarkPaid([tx("a"), tx("b", { status: "paid" }), tx("c", { status: "overdue" })]);
    expect(chunks).toEqual([["a", "c"]]);
  });

  it("divide em lotes do teto da API", () => {
    const many = Array.from({ length: STATUS_BATCH_MAX_IDS + 5 }, (_, i) => tx(`t${i}`));
    const chunks = planBulkMarkPaid(many);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(STATUS_BATCH_MAX_IDS);
    expect(chunks[1]).toHaveLength(5);
  });

  it("nada a fazer quando todos já estão pagos", () => {
    expect(planBulkMarkPaid([tx("a", { status: "paid" })])).toEqual([]);
  });
});

describe("planBulkDelete", () => {
  it("deixa de fora lançamento de proposta", () => {
    const { deletable, skippedProposal } = planBulkDelete([
      tx("a"),
      tx("b", { proposalId: "p1" }),
    ]);
    expect(deletable.map((t) => t.id)).toEqual(["a"]);
    expect(skippedProposal.map((t) => t.id)).toEqual(["b"]);
  });
});

describe("buildExportRows", () => {
  const wallets = [{ id: "w1", name: "Conta Principal" }];

  it("traduz tipo e status, resolve a carteira e assina a despesa", () => {
    const [row] = buildExportRows(
      [tx("a", { type: "expense", amount: 50, status: "paid", wallet: "w1" })],
      wallets,
    );
    expect(row).toMatchObject({
      tipo: "Despesa",
      status: "Pago",
      carteira: "Conta Principal",
      valor: -50,
    });
  });

  it("converte datas em data local e mostra a parcela", () => {
    const [row] = buildExportRows(
      [
        tx("a", {
          dueDate: "2026-10-05",
          isInstallment: true,
          installmentNumber: 2,
          installmentCount: 5,
        }),
      ],
      wallets,
    );
    expect(row.vencimento).toEqual(new Date(2026, 9, 5));
    expect(row.parcela).toBe("2/5");
  });

  it("ordena por vencimento", () => {
    const rows = buildExportRows(
      [tx("b", { dueDate: "2026-10-10" }), tx("a", { dueDate: "2026-10-01" })],
      wallets,
    );
    expect(rows.map((r) => r.descricao)).toEqual(["Lançamento a", "Lançamento b"]);
  });
});
