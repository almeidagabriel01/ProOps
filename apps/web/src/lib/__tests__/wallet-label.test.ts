import { describe, expect, it } from "vitest";
import { isSameWallet, walletLabel } from "../wallet-label";
import { computeMonthStats } from "../dashboard-metrics";
import type { Transaction } from "@/services/transaction-service";

/**
 * O lançamento guarda a carteira pelo nome (antigos) ou pelo id (novos: a OS
 * lançada, a mensalidade do contrato). A tela mostrava o id cru.
 */
const wallets = [
  { id: "w1", name: "Itaú" },
  { id: "w2", name: "Caixa" },
];

describe("walletLabel", () => {
  it("id vira o nome; nome continua nome", () => {
    expect(walletLabel("w1", wallets)).toBe("Itaú");
    expect(walletLabel("Caixa", wallets)).toBe("Caixa");
  });

  it("carteira apagada ou lista ainda carregando mostra o valor gravado", () => {
    expect(walletLabel("w9", wallets)).toBe("w9");
    expect(walletLabel("w1", [])).toBe("w1");
    expect(walletLabel(undefined, wallets)).toBe("");
  });

  it("compara a carteira pelo id ou pelo nome", () => {
    expect(isSameWallet("w1", wallets[0])).toBe(true);
    expect(isSameWallet("Itaú", wallets[0])).toBe(true);
    expect(isSameWallet("w2", wallets[0])).toBe(false);
  });
});

describe("movimento por carteira do Dashboard", () => {
  it("soma pelo nome, venha o lançamento com id ou com nome", () => {
    const tx = (over: Partial<Transaction>) =>
      ({ type: "income", status: "paid", amount: 100, date: "2026-10-05", ...over }) as Transaction;
    const stats = computeMonthStats([tx({ wallet: "w1" }), tx({ wallet: "Itaú" }), tx({ wallet: "w2" })], "2026-10", wallets);
    expect(stats.incomeByWallet).toEqual({ "Itaú": 200, Caixa: 100 });
  });
});
