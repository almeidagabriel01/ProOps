/**
 * Lançamentos pela Lia.
 *
 * - Excluir apagava o documento direto: um lançamento PAGO sumia e o saldo da
 *   carteira ficava errado, sem a trava da proposta aprovada. Agora passa pelo
 *   `TransactionService.deleteTransaction`, o mesmo da tela.
 * - Pagar parcela lia a carteira depois de gravar dentro da transação (o
 *   Firestore recusa) e gravava `paidAt` como texto. Agora passa pelo
 *   `TransactionService.updateTransaction`.
 * - Criar aceitava carteira e proposta de qualquer id, inclusive de outra
 *   empresa.
 */

type Doc = Record<string, unknown>;
let store: Record<string, Record<string, Doc>>;
const writes: Array<{ collection: string; id: string; data: Doc }> = [];

const deleteTransaction = jest.fn();
const updateTransaction = jest.fn();

jest.mock("./transaction.service", () => ({
  TransactionService: {
    deleteTransaction: (...a: unknown[]) => deleteTransaction(...a),
    updateTransaction: (...a: unknown[]) => updateTransaction(...a),
  },
}));

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id ?? `novo-${writes.length + 1}`;
        return {
          id: docId,
          get: async () => ({ exists: !!store[name]?.[docId], data: () => store[name]?.[docId] }),
          set: async (data: Doc) => {
            writes.push({ collection: name, id: docId, data });
          },
          update: async (data: Doc) => {
            writes.push({ collection: name, id: docId, data });
          },
        };
      },
    }),
    batch: () => ({ set: jest.fn(), commit: jest.fn() }),
  },
}));

import {
  createTransactionForAi,
  deleteTransactionForAi,
  payInstallmentForAi,
} from "./transaction-ai.service";

const ACTOR = { uid: "u1", role: "admin", tenantId: "t1" };

beforeEach(() => {
  jest.clearAllMocks();
  writes.length = 0;
  store = {
    wallets: { w1: { tenantId: "t1", name: "Caixa" }, wOutra: { tenantId: "t2", name: "Outra" } },
    proposals: { p1: { tenantId: "t1" }, pOutra: { tenantId: "t2" } },
    transactions: {
      parcela2: { tenantId: "t1", isInstallment: true, installmentNumber: 2, status: "pending", amount: 100 },
      paga: { tenantId: "t1", isInstallment: true, installmentNumber: 1, status: "paid", amount: 100 },
      alheia: { tenantId: "t2", isInstallment: true, installmentNumber: 1, status: "pending" },
    },
  };
});

describe("excluir pela Lia", () => {
  it("passa pelo serviço da tela, com a identidade de quem pediu", async () => {
    await deleteTransactionForAi("tx1", ACTOR);
    expect(deleteTransaction).toHaveBeenCalledWith("u1", { uid: "u1", role: "ADMIN", tenantId: "t1" }, "tx1");
    expect(writes).toHaveLength(0);
  });

  it("o erro do serviço (proposta aprovada, sem permissão) chega à Lia", async () => {
    deleteTransaction.mockRejectedValueOnce(new Error("Não é possível excluir um lançamento vinculado a uma proposta Aprovada."));
    await expect(deleteTransactionForAi("tx1", ACTOR)).rejects.toThrow("proposta Aprovada");
  });
});

describe("pagar parcela pela Lia", () => {
  it("marca paga pelo serviço da tela", async () => {
    await payInstallmentForAi("parcela2", 2, ACTOR);
    expect(updateTransaction).toHaveBeenCalledWith(
      "u1",
      { uid: "u1", role: "ADMIN", tenantId: "t1" },
      "parcela2",
      { status: "paid" },
    );
  });

  it("data de pagamento informada vira Timestamp, como a tela grava", async () => {
    await payInstallmentForAi("parcela2", 2, ACTOR, "2026-10-01");
    const paidAt = writes.find((w) => w.id === "parcela2")?.data.paidAt as { toDate: () => Date };
    expect(paidAt.toDate().toISOString()).toBe("2026-10-01T15:00:00.000Z");
  });

  it("parcela errada, já paga ou de outra empresa não chega ao serviço", async () => {
    await expect(payInstallmentForAi("parcela2", 3, ACTOR)).rejects.toThrow("Número de parcela");
    await expect(payInstallmentForAi("paga", 1, ACTOR)).rejects.toThrow("ja esta paga");
    await expect(payInstallmentForAi("alheia", 1, ACTOR)).rejects.toThrow("não pertence");
    expect(updateTransaction).not.toHaveBeenCalled();
  });
});

describe("criar pela Lia", () => {
  const base = { type: "expense" as const, description: "Aluguel", amount: 1000, date: "2026-10-10" };

  it("recusa carteira de outra empresa ou inexistente", async () => {
    await expect(createTransactionForAi({ ...base, walletId: "wOutra" }, "t1", "u1")).rejects.toThrow("Carteira");
    await expect(createTransactionForAi({ ...base, walletId: "nada" }, "t1", "u1")).rejects.toThrow("Carteira");
    expect(writes).toHaveLength(0);
  });

  it("recusa proposta de outra empresa", async () => {
    await expect(
      createTransactionForAi({ ...base, walletId: "w1", proposalId: "pOutra" }, "t1", "u1"),
    ).rejects.toThrow("Proposta");
    expect(writes).toHaveLength(0);
  });

  it("cria pendente na carteira da empresa", async () => {
    const result = await createTransactionForAi({ ...base, walletId: "w1", proposalId: "p1" }, "t1", "u1");
    expect(result.status).toBe("pending");
    expect(writes[0].data).toMatchObject({ tenantId: "t1", wallet: "w1", proposalId: "p1", status: "pending", createdById: "u1" });
  });
});
