/**
 * O vendedor nos lançamentos de proposta: o sync e o backfill decidem pela
 * mesma regra. A comissão nunca leva vendedor, e o que já bate não é regravado.
 */
import { expectedTransactionSeller } from "../transaction-seller";

describe("expectedTransactionSeller", () => {
  it("receita da proposta leva o vendedor dela", () => {
    expect(expectedTransactionSeller({ proposalId: "p1", type: "income" }, "vend")).toBe("vend");
  });

  it("o que já bate não muda", () => {
    expect(expectedTransactionSeller({ proposalId: "p1", sellerId: "vend" }, "vend")).toBeUndefined();
    expect(expectedTransactionSeller({ proposalId: "p1" }, null)).toBeUndefined();
  });

  it("vendedor trocado na proposta troca no lançamento; tirado, apaga", () => {
    expect(expectedTransactionSeller({ proposalId: "p1", sellerId: "antigo" }, "novo")).toBe("novo");
    expect(expectedTransactionSeller({ proposalId: "p1", sellerId: "antigo" }, null)).toBeNull();
  });

  it("comissão fica sem vendedor, e lançamento avulso não é tocado", () => {
    expect(expectedTransactionSeller({ proposalId: "p1", isCommission: true, sellerId: "vend" }, "vend")).toBeNull();
    expect(expectedTransactionSeller({ proposalId: "p1", isCommission: true }, "vend")).toBeUndefined();
    expect(expectedTransactionSeller({ type: "expense" }, "vend")).toBeUndefined();
  });
});
