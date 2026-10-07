/**
 * O que cada mudança de lançamento pede no catálogo de permissões: ir para
 * pago é dar baixa, sair de pago é estornar, e só a mudança de verdade nos
 * custos extras conta (o formulário reenvia a lista inteira).
 */
jest.mock("../../init", () => ({ db: {} }));

import { extraCostsChanged, statusChangeKey } from "../finance-helpers";

describe("statusChangeKey", () => {
  it("pago é baixa, sair de pago é estorno", () => {
    expect(statusChangeKey("pending", "paid")).toBe("settle");
    expect(statusChangeKey("overdue", "paid")).toBe("settle");
    expect(statusChangeKey("paid", "pending")).toBe("revert");
    expect(statusChangeKey("paid", "overdue")).toBe("revert");
  });

  it("sem mudança, ou entre pendente e atrasado, não pede nada", () => {
    expect(statusChangeKey("paid", "paid")).toBeNull();
    expect(statusChangeKey("pending", undefined)).toBeNull();
    expect(statusChangeKey("pending", "overdue")).toBeNull();
  });
});

describe("extraCostsChanged", () => {
  const A = [
    { id: "e1", description: "Frete", amount: 20, status: "pending" },
    { id: "e2", description: "Taxa", amount: 5.5, status: "paid", wallet: "w1" },
  ];

  it("reenvio igual, em outra ordem, não é mudança", () => {
    expect(extraCostsChanged(A, [A[1], A[0]])).toBe(false);
    expect(extraCostsChanged(A, A.map((e) => ({ ...e, amount: String(e.amount) })))).toBe(false);
  });

  it("valor, descrição, status, carteira, inclusão e remoção contam", () => {
    expect(extraCostsChanged(A, [{ ...A[0], amount: 21 }, A[1]])).toBe(true);
    expect(extraCostsChanged(A, [{ ...A[0], description: "Frete aéreo" }, A[1]])).toBe(true);
    expect(extraCostsChanged(A, [{ ...A[0], status: "paid" }, A[1]])).toBe(true);
    expect(extraCostsChanged(A, [A[0], { ...A[1], wallet: "w2" }])).toBe(true);
    expect(extraCostsChanged(A, [A[0]])).toBe(true);
    expect(extraCostsChanged([], undefined)).toBe(false);
  });
});
