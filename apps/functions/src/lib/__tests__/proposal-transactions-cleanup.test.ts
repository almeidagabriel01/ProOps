/**
 * Regressão: `cleanupProposalTransactions` resolvia a carteira de cada
 * lançamento pago DEPOIS de já ter apagado o anterior na mesma transação. O
 * Admin SDK lança em leitura após escrita, o erro era engolido, e reverter ou
 * excluir uma proposta com dois ou mais lançamentos pagos não estornava nada e
 * deixava os lançamentos órfãos.
 *
 * A transação falsa daqui lança do mesmo jeito que o SDK real.
 */

jest.mock("../../init", () => ({ db: {} }));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => ({ __increment: n }) },
  Timestamp: { now: () => "now" },
}));

import { applyProposalTransactionsCleanup } from "../proposal-transactions-cleanup";

const TENANT = "tenant-1";

type Wallet = { id: string; name: string; tenantId: string };

function makeDb(wallets: Wallet[]) {
  const docRef = (id: string) => ({ kind: "doc", id, path: `wallets/${id}` });
  return {
    collection: (name: string) => {
      if (name !== "wallets") throw new Error(`coleção inesperada ${name}`);
      const filters: Record<string, string> = {};
      const query = {
        kind: "query",
        filters,
        where(field: string, _op: string, value: string) {
          filters[field] = value;
          return query;
        },
        limit() {
          return query;
        },
      };
      return {
        doc: docRef,
        where: query.where,
      };
    },
    wallets,
    docRef,
  };
}

function makeTransaction(wallets: Wallet[]) {
  let wrote = false;
  const updates: Array<{ path: string; balance: unknown }> = [];
  const deletes: string[] = [];
  const t = {
    async get(target: {
      kind: string;
      id?: string;
      filters?: Record<string, string>;
    }) {
      if (wrote) {
        throw new Error(
          "Firestore transactions require all reads to be executed before all writes.",
        );
      }
      if (target.kind === "doc") {
        const w = wallets.find((x) => x.id === target.id);
        return { exists: !!w, data: () => w };
      }
      const w = wallets.find(
        (x) =>
          x.tenantId === target.filters?.tenantId &&
          x.name === target.filters?.name,
      );
      return {
        empty: !w,
        docs: w
          ? [{ ref: { kind: "doc", id: w.id, path: `wallets/${w.id}` }, data: () => w }]
          : [],
      };
    },
    update(ref: { path: string }, data: { balance: unknown }) {
      wrote = true;
      updates.push({ path: ref.path, balance: data.balance });
    },
    delete(ref: { path: string }) {
      wrote = true;
      deletes.push(ref.path);
    },
  };
  return { t, updates, deletes };
}

function txDoc(id: string, data: Record<string, unknown>) {
  return { ref: { path: `transactions/${id}` }, data: () => data };
}

async function run(wallets: Wallet[], docs: ReturnType<typeof txDoc>[]) {
  const db = makeDb(wallets);
  const { t, updates, deletes } = makeTransaction(wallets);
  await applyProposalTransactionsCleanup(
    t as unknown as FirebaseFirestore.Transaction,
    db as unknown as FirebaseFirestore.Firestore,
    TENANT,
    docs as never,
  );
  return { updates, deletes };
}

const W1: Wallet = { id: "w1", name: "Caixa", tenantId: TENANT };
const W2: Wallet = { id: "w2", name: "Banco", tenantId: TENANT };

describe("applyProposalTransactionsCleanup", () => {
  it("estorna e apaga com um lançamento pago", async () => {
    const { updates, deletes } = await run(
      [W1],
      [txDoc("a", { status: "paid", type: "income", wallet: "w1", amount: 100 })],
    );
    expect(updates).toEqual([{ path: "wallets/w1", balance: { __increment: -100 } }]);
    expect(deletes).toEqual(["transactions/a"]);
  });

  it("dois pagos na mesma carteira: não lê depois de escrever e soma o estorno", async () => {
    const { updates, deletes } = await run(
      [W1],
      [
        txDoc("a", { status: "paid", type: "income", wallet: "w1", amount: 100 }),
        txDoc("b", { status: "paid", type: "income", wallet: "w1", amount: 50 }),
      ],
    );
    expect(updates).toEqual([{ path: "wallets/w1", balance: { __increment: -150 } }]);
    expect(deletes).toEqual(["transactions/a", "transactions/b"]);
  });

  it("pagos em carteiras diferentes, receita e despesa", async () => {
    const { updates, deletes } = await run(
      [W1, W2],
      [
        txDoc("a", { status: "paid", type: "income", wallet: "w1", amount: 100 }),
        txDoc("b", { status: "paid", type: "expense", wallet: "w2", amount: 30 }),
      ],
    );
    expect(updates).toEqual([
      { path: "wallets/w1", balance: { __increment: -100 } },
      { path: "wallets/w2", balance: { __increment: 30 } },
    ]);
    expect(deletes).toHaveLength(2);
  });

  it("carteira gravada pelo NOME (dado legado)", async () => {
    const { updates } = await run(
      [W1, W2],
      [
        txDoc("a", { status: "paid", type: "income", wallet: "Banco", amount: 80 }),
        txDoc("b", { status: "paid", type: "income", wallet: "Caixa", amount: 20 }),
      ],
    );
    expect(updates).toEqual([
      { path: "wallets/w2", balance: { __increment: -80 } },
      { path: "wallets/w1", balance: { __increment: -20 } },
    ]);
  });

  it("pago + pendente: só o pago estorna, os dois são apagados", async () => {
    const { updates, deletes } = await run(
      [W1],
      [
        txDoc("a", { status: "pending", type: "income", wallet: "w1", amount: 100 }),
        txDoc("b", { status: "paid", type: "income", wallet: "w1", amount: 40 }),
        txDoc("c", { status: "paid", type: "income", wallet: "w1", amount: 60 }),
      ],
    );
    expect(updates).toEqual([{ path: "wallets/w1", balance: { __increment: -100 } }]);
    expect(deletes).toEqual(["transactions/a", "transactions/b", "transactions/c"]);
  });

  it("nenhum pago: apaga sem mexer em carteira", async () => {
    const { updates, deletes } = await run(
      [W1],
      [
        txDoc("a", { status: "pending", type: "income", wallet: "w1", amount: 100 }),
        txDoc("b", { status: "overdue", type: "income", wallet: "w1", amount: 100 }),
      ],
    );
    expect(updates).toEqual([]);
    expect(deletes).toHaveLength(2);
  });

  it("carteira de outro tenant não é estornada", async () => {
    const { updates, deletes } = await run(
      [{ id: "w9", name: "Alheia", tenantId: "outro" }],
      [txDoc("a", { status: "paid", type: "income", wallet: "w9", amount: 10 })],
    );
    expect(updates).toEqual([]);
    expect(deletes).toEqual(["transactions/a"]);
  });
});
