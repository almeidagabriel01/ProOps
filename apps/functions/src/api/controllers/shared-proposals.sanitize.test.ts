/**
 * O link público da proposta levava cada linha inteira, e na proposta gravada
 * `unitPrice` é o CUSTO e `markup` é a margem: o cliente final lia os dois no
 * JSON da página. A resposta pública agora leva só o preço de venda.
 */

jest.mock("../../init", () => ({ auth: {}, db: {} }));
jest.mock("../services/shared-proposal.service", () => ({ SharedProposalService: {} }));
jest.mock("./proposal-online-approval.controller", () => ({
  resolveOnlineApprovalState: jest.fn(),
}));

import { sanitizeSharedProposalPayload } from "./shared-proposals.controller";

describe("sanitizeSharedProposalPayload", () => {
  const proposal = {
    tenantId: "t1",
    title: "Casa do Mauricio",
    totalValue: 3642.24,
    extraExpense: 0,
    products: [
      { productId: "p1", productName: "Câmera", quantity: 2, unitPrice: 1167, markup: 50, total: 3501 },
      { productId: "p2", productName: "Fonte", quantity: 1, unitPrice: 98, markup: 44, total: 141.24 },
    ],
    commissions: [{ contactId: "c1", percent: 5 }],
  };

  it("não leva custo nem markup de nenhuma linha", () => {
    const safe = sanitizeSharedProposalPayload("prop1", proposal) as {
      products: Array<Record<string, unknown>>;
    };
    const json = JSON.stringify(safe);

    expect(json).not.toContain("markup");
    expect(json).not.toContain("1167");
    expect(safe.products.map((p) => p.unitPrice)).toEqual([1750.5, 141.24]);
  });

  it("os totais por linha e o total da proposta não mudam", () => {
    const safe = sanitizeSharedProposalPayload("prop1", proposal) as {
      products: Array<Record<string, unknown>>;
      totalValue: number;
    };

    expect(safe.products.map((p) => p.total)).toEqual([3501, 141.24]);
    expect(safe.totalValue).toBe(3642.24);
  });

  it("continua fora o que já estava fora (comissões)", () => {
    const safe = sanitizeSharedProposalPayload("prop1", proposal);
    expect(safe).not.toHaveProperty("commissions");
  });
});
