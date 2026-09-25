/**
 * Operações em lote de lançamentos liam cada doc com um t.get em série, com a
 * transação aberta (até 200 idas ao servidor). Agora é um t.getAll só, na
 * ordem dos ids, e o resultado (status, saldo das carteiras) não muda.
 */

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("../../../lib/finance-helpers", () => ({
  checkFinancialPermission: jest.fn(async () => ({ tenantId: "t1", isSuperAdmin: false })),
  resolveWalletRef: jest.fn(async (_t: unknown, _db: unknown, _tenant: string, wallet: string) => ({
    ref: { path: `wallets/${wallet}` },
  })),
  addMonths: jest.fn(),
}));

type Row = Record<string, unknown>;
let docs: Record<string, Row>;
let getAllCalls: string[][];
let singleGets: number;
let updates: Array<{ path: string; data: Row }>;

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => {
      const query: Record<string, unknown> = { kind: "query" };
      query.where = () => query;
      query.limit = () => query;
      query.orderBy = () => query;
      return {
        ...query,
        doc: (id?: string) => ({ path: `${name}/${id ?? "novo"}`, id: id ?? "novo" }),
      };
    },
    runTransaction: async (fn: (t: unknown) => Promise<unknown>) =>
      fn({
        getAll: async (...refs: Array<{ id: string; path: string }>) => {
          getAllCalls.push(refs.map((r) => r.id));
          return refs.map((r) => ({
            id: r.id,
            exists: r.id in docs,
            data: () => docs[r.id],
          }));
        },
        get: async () => {
          singleGets += 1;
          return { exists: false, data: () => undefined, docs: [], empty: true };
        },
        update: (ref: { path: string }, data: Row) => updates.push({ path: ref.path, data }),
        set: jest.fn(),
        delete: jest.fn(),
      }),
  },
}));

import { TransactionService } from "../transaction.service";

const USER = { uid: "u1", role: "MASTER", tenantId: "t1" };

beforeEach(() => {
  docs = {
    a: { tenantId: "t1", type: "income", amount: 100, status: "pending", wallet: "w1" },
    b: { tenantId: "t1", type: "expense", amount: 30, status: "pending", wallet: "w1" },
    c: { tenantId: "t1", type: "income", amount: 50, status: "pending", wallet: "w2" },
  };
  getAllCalls = [];
  singleGets = 0;
  updates = [];
});

describe("updateStatusBatch", () => {
  it("lê todos os lançamentos num getAll só, na ordem, e acerta os saldos", async () => {
    const count = await TransactionService.updateStatusBatch(
      "u1",
      USER as never,
      ["a", "b", "c", "missing"],
      "paid",
    );

    expect(count).toBe(4);
    expect(getAllCalls).toEqual([["a", "b", "c", "missing"]]);
    expect(singleGets).toBe(0);

    const txUpdates = updates.filter((u) => u.path.startsWith("transactions/"));
    expect(txUpdates.map((u) => u.path)).toEqual([
      "transactions/a",
      "transactions/b",
      "transactions/c",
    ]);
    expect(txUpdates.every((u) => u.data.status === "paid")).toBe(true);

    const walletDelta = (path: string) =>
      (updates.find((u) => u.path === path)?.data.balance as { operand?: number })?.operand;
    expect(walletDelta("wallets/w1")).toBe(70);
    expect(walletDelta("wallets/w2")).toBe(50);
  });

  it("lote que passaria de 500 escritas é recusado com mensagem clara, antes de gravar", async () => {
    docs = {};
    const ids: string[] = [];
    for (let i = 0; i < 200; i++) {
      ids.push(`r${i}`);
      docs[`r${i}`] = {
        tenantId: "t1",
        type: "expense",
        amount: 1,
        status: "pending",
        isRecurring: true,
        recurringGroupId: `g${i}`,
        installmentNumber: 1,
        proposalId: `p${i}`,
      };
    }
    await expect(
      TransactionService.updateStatusBatch("u1", USER as never, ids, "paid"),
    ).rejects.toThrow("registros demais de uma vez");
    expect(updates).toEqual([]);
  });

  it("lançamento de outro tenant é recusado", async () => {
    docs.b.tenantId = "outro";
    await expect(
      TransactionService.updateStatusBatch("u1", USER as never, ["a", "b"], "paid"),
    ).rejects.toThrow("Acesso negado.");
  });
});

describe("updateTransactionsBatch", () => {
  it("lê todos num getAll só e aplica cada update ao doc certo", async () => {
    await TransactionService.updateTransactionsBatch("u1", USER as never, [
      { id: "c", data: { description: "C nova" } },
      { id: "a", data: { description: "A nova" } },
    ]);

    expect(getAllCalls).toEqual([["c", "a"]]);
    expect(singleGets).toBe(0);
    const byPath = Object.fromEntries(
      updates.filter((u) => u.path.startsWith("transactions/")).map((u) => [u.path, u.data]),
    );
    expect(byPath["transactions/c"]).toMatchObject({ description: "C nova" });
    expect(byPath["transactions/a"]).toMatchObject({ description: "A nova" });
  });
});
