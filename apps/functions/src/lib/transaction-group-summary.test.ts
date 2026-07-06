/**
 * computeGroupSummary deve espelhar EXATAMENTE a prioridade de agrupamento do
 * frontend (getGroupedTransactionKey): proposalGroupId > installmentGroupId |
 * recurringGroupId > avulso. Totais por membro vêm de computeTransactionTotals
 * — nunca recalcular a semântica de extraCosts aqui.
 */

import {
  computeGroupSummary,
  groupDocIdFromKey,
  resolveGroupKey,
} from "./transaction-group-summary";

const TODAY = "2026-07-06";

describe("resolveGroupKey", () => {
  it("prioriza proposalGroupId sobre installmentGroupId", () => {
    expect(
      resolveGroupKey({
        proposalGroupId: "prop1",
        installmentGroupId: "inst1",
      }),
    ).toBe("proposal:prop1");
  });

  it("usa installmentGroupId quando não há proposalGroupId", () => {
    expect(resolveGroupKey({ installmentGroupId: "inst1" })).toBe(
      "group:inst1",
    );
  });

  it("usa recurringGroupId quando não há os demais", () => {
    expect(resolveGroupKey({ recurringGroupId: "rec1" })).toBe("group:rec1");
  });

  it("retorna null para avulso (sem grupo)", () => {
    expect(resolveGroupKey({})).toBeNull();
    expect(
      resolveGroupKey({ proposalGroupId: "", installmentGroupId: null }),
    ).toBeNull();
  });

  it("ignora valores não-string", () => {
    expect(resolveGroupKey({ proposalGroupId: 123 })).toBeNull();
  });
});

describe("groupDocIdFromKey", () => {
  it('troca ":" por "_"', () => {
    expect(groupDocIdFromKey("proposal:abc")).toBe("proposal_abc");
    expect(groupDocIdFromKey("group:xyz")).toBe("group_xyz");
  });
});

describe("computeGroupSummary", () => {
  it("retorna null para members vazio (grupo sumiu)", () => {
    expect(computeGroupSummary("t1", "group:g1", [], TODAY)).toBeNull();
  });

  it("grupo de proposta com entrada: kind proposal, memberCount inclui entrada, âncora é installmentNumber 1", () => {
    const members = [
      {
        proposalGroupId: "p1",
        installmentGroupId: "i1",
        proposalId: "prop-doc",
        installmentNumber: 0,
        isDownPayment: true,
        description: "Entrada",
        type: "income",
        wallet: "w-entrada",
        clientName: "Cliente X",
        amount: 100,
        status: "paid",
        dueDate: "2026-06-01",
      },
      {
        proposalGroupId: "p1",
        installmentGroupId: "i1",
        proposalId: "prop-doc",
        installmentNumber: 1,
        description: "Projeto (1/2)",
        type: "income",
        wallet: "w-parcelas",
        clientName: "Cliente X",
        amount: 200,
        status: "paid",
        dueDate: "2026-07-01",
      },
      {
        proposalGroupId: "p1",
        installmentGroupId: "i1",
        proposalId: "prop-doc",
        installmentNumber: 2,
        description: "Projeto (2/2)",
        type: "income",
        wallet: "w-parcelas",
        clientName: "Cliente X",
        amount: 200,
        status: "pending",
        dueDate: "2026-08-01",
      },
    ];
    const summary = computeGroupSummary("t1", "proposal:p1", members, TODAY);
    expect(summary).toMatchObject({
      tenantId: "t1",
      groupKey: "proposal:p1",
      kind: "proposal",
      type: "income",
      description: "Projeto (1/2)",
      wallet: "w-parcelas",
      clientName: "Cliente X",
      proposalId: "prop-doc",
      memberCount: 3,
      paidCount: 2,
      total: 500,
      paidTotal: 300,
      pendingTotal: 200,
      nextDueDate: "2026-08-01",
      firstDueDate: "2026-06-01",
      lastDueDate: "2026-08-01",
      status: "pending",
    });
  });

  it("parcelamento 3x com 1 paga: paidCount 1, nextDueDate da próxima não-paga, status pending", () => {
    const members = [
      {
        installmentGroupId: "g1",
        installmentNumber: 1,
        description: "Compra (1/3)",
        type: "expense",
        amount: 50,
        status: "paid",
        dueDate: "2026-07-01",
      },
      {
        installmentGroupId: "g1",
        installmentNumber: 2,
        description: "Compra (2/3)",
        type: "expense",
        amount: 50,
        status: "pending",
        dueDate: "2026-08-01",
      },
      {
        installmentGroupId: "g1",
        installmentNumber: 3,
        description: "Compra (3/3)",
        type: "expense",
        amount: 50,
        status: "pending",
        dueDate: "2026-09-01",
      },
    ];
    const summary = computeGroupSummary("t1", "group:g1", members, TODAY);
    expect(summary).toMatchObject({
      kind: "installment",
      memberCount: 3,
      paidCount: 1,
      paidTotal: 50,
      pendingTotal: 100,
      total: 150,
      nextDueDate: "2026-08-01",
      firstDueDate: "2026-07-01",
      lastDueDate: "2026-09-01",
      status: "pending",
    });
  });

  it("membro pending com dueDate < today → status overdue", () => {
    const members = [
      {
        installmentGroupId: "g1",
        installmentNumber: 1,
        type: "expense",
        amount: 50,
        status: "pending",
        dueDate: "2026-07-01",
      },
    ];
    const summary = computeGroupSummary("t1", "group:g1", members, TODAY);
    expect(summary?.status).toBe("overdue");
  });

  it("membro com status overdue persistido → status overdue", () => {
    const members = [
      {
        installmentGroupId: "g1",
        installmentNumber: 1,
        type: "expense",
        amount: 50,
        status: "overdue",
        dueDate: "2026-08-01",
      },
      {
        installmentGroupId: "g1",
        installmentNumber: 2,
        type: "expense",
        amount: 50,
        status: "pending",
        dueDate: "2026-09-01",
      },
    ];
    const summary = computeGroupSummary("t1", "group:g1", members, TODAY);
    expect(summary?.status).toBe("overdue");
  });

  it("todas pagas → status paid, nextDueDate null", () => {
    const members = [
      {
        recurringGroupId: "r1",
        type: "income",
        amount: 80,
        status: "paid",
        dueDate: "2026-05-01",
      },
      {
        recurringGroupId: "r1",
        type: "income",
        amount: 80,
        status: "paid",
        dueDate: "2026-06-01",
      },
    ];
    const summary = computeGroupSummary("t1", "group:r1", members, TODAY);
    expect(summary).toMatchObject({
      kind: "recurring",
      status: "paid",
      paidCount: 2,
      nextDueDate: null,
      firstDueDate: "2026-05-01",
      lastDueDate: "2026-06-01",
    });
  });

  it("âncora fallback: sem installmentNumber >= 1, usa menor dueDate", () => {
    const members = [
      {
        recurringGroupId: "r1",
        description: "Mensalidade fev",
        type: "income",
        amount: 80,
        status: "paid",
        dueDate: "2026-02-01",
      },
      {
        recurringGroupId: "r1",
        description: "Mensalidade jan",
        type: "income",
        amount: 80,
        status: "paid",
        dueDate: "2026-01-01",
      },
    ];
    const summary = computeGroupSummary("t1", "group:r1", members, TODAY);
    expect(summary?.description).toBe("Mensalidade jan");
  });

  it("extraCosts entram nos totais via computeTransactionTotals", () => {
    const members = [
      {
        installmentGroupId: "g1",
        installmentNumber: 1,
        type: "expense",
        amount: 100,
        status: "paid",
        extraCosts: [{ amount: 30, status: "pending" }],
        dueDate: "2026-07-01",
      },
    ];
    const summary = computeGroupSummary("t1", "group:g1", members, TODAY);
    expect(summary).toMatchObject({
      paidTotal: 100,
      pendingTotal: 30,
      total: 130,
    });
  });
});
