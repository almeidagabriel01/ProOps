jest.mock("../../init", () => ({
  db: {},
  auth: {},
  adminApp: {},
}));

import { buildApprovedProposalTransactionDrafts } from "./proposals.helpers";

const BASE_PARAMS = {
  proposalId: "test-proposal-1",
  userId: "user-1",
  defaultWalletName: "main-wallet",
};

function makeProposalData(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    tenantId: "tenant-1",
    clientId: null,
    clientName: null,
    title: "Test Proposal",
    totalValue: 1000,
    closedValue: null,
    downPaymentEnabled: false,
    downPaymentType: "fixed",
    downPaymentValue: 0,
    downPaymentPercentage: 0,
    installmentsEnabled: false,
    installmentsCount: 0,
    installmentValue: 0,
    ...overrides,
  };
}

describe("buildApprovedProposalTransactionDrafts", () => {
  // U1: no down payment, no installments, no closedValue → single draft for totalValue
  test("U1: single draft with totalValue when no closedValue, no downPayment, no installments", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({ closedValue: undefined }),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].amount).toBe(1000);
    expect(drafts[0].isDownPayment).toBe(false);
    expect(drafts[0].isInstallment).toBe(false);
    expect(drafts[0].proposalId).toBe("test-proposal-1");
  });

  // U2: closedValue=0 is falsy → falls back to totalValue=1000
  test("U2: single draft with totalValue when closedValue is 0 (falsy)", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({ closedValue: 0 }),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].amount).toBe(1000);
  });

  // U3: closedValue=800 overrides totalValue
  test("U3: single draft uses closedValue=800 instead of totalValue=1000", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({ closedValue: 800 }),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].amount).toBe(800);
  });

  // U4: down payment with balance should emit down_payment + single
  test("U4: downPayment fixed=200 + totalValue=1000 → down_payment(200) + single(800)", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 200,
        totalValue: 1000,
      }),
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0].isDownPayment).toBe(true);
    expect(drafts[0].amount).toBe(200);
    expect(drafts[1].isDownPayment).toBe(false);
    expect(drafts[1].amount).toBe(800);
  });

  // U5: percentage down payment computes 25% of 1000=250, balance=750
  test("U5: downPayment percentage=25% of 1000 → down_payment(250) + single(750)", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "percentage",
        downPaymentPercentage: 25,
        totalValue: 1000,
      }),
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0].isDownPayment).toBe(true);
    expect(drafts[0].amount).toBe(250);
    expect(drafts[1].amount).toBe(750);
  });

  // U6: downPaymentValue equals totalValue → only down_payment, no single (balance=0)
  test("U6: downPaymentValue=1000 equals totalValue → only down_payment draft, no single", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 1000,
        totalValue: 1000,
      }),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].isDownPayment).toBe(true);
    expect(drafts[0].amount).toBe(1000);
  });

  // U7: downPaymentValue > totalValue should be capped at totalValue
  test("U7: downPaymentValue=1500 > totalValue=1000 → capped down_payment(1000), no single", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 1500,
        totalValue: 1000,
      }),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].isDownPayment).toBe(true);
    expect(drafts[0].amount).toBe(1000);
  });

  // U8: closedValue=800 with downPayment=200 should produce down_payment(200) + single(600)
  test("U8: closedValue=800, downPayment=200 → down_payment(200) + single(600)", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 200,
        closedValue: 800,
        totalValue: 3000,
      }),
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0].isDownPayment).toBe(true);
    expect(drafts[0].amount).toBe(200);
    expect(drafts[1].isDownPayment).toBe(false);
    expect(drafts[1].amount).toBe(600);
  });

  // U9: installments only (3×), no down payment
  test("U9: 3 installments of 333.33 each (no down payment)", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        installmentsEnabled: true,
        installmentsCount: 3,
      }),
    });

    expect(drafts).toHaveLength(3);
    drafts.forEach((d, i) => {
      expect(d.isInstallment).toBe(true);
      expect(d.isDownPayment).toBe(false);
      expect(d.amount).toBeCloseTo(1000 / 3);
      expect(d.installmentNumber).toBe(i + 1);
      expect(d.installmentCount).toBe(3);
    });
  });

  // U10: down payment (fixed=100) + 3 installments (each 300)
  test("U10: down_payment(100) + 3 installments of 300 each", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 100,
        installmentsEnabled: true,
        installmentsCount: 3,
        totalValue: 1000,
      }),
    });

    expect(drafts).toHaveLength(4);

    const downPayment = drafts.find((d) => d.isDownPayment);
    expect(downPayment).toBeDefined();
    expect(downPayment!.amount).toBe(100);

    const installments = drafts.filter((d) => d.isInstallment);
    expect(installments).toHaveLength(3);
    installments.forEach((d) => {
      expect(d.amount).toBeCloseTo(300);
    });
  });

  // U11: downPaymentPercentage=0 → effectiveDownPayment=0 → downPaymentEnabled=false → single=1000
  test("U11: downPaymentPercentage=0 makes downPaymentEnabled=false → single draft of 1000", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "percentage",
        downPaymentPercentage: 0,
        downPaymentValue: 0,
        totalValue: 1000,
      }),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].isDownPayment).toBe(false);
    expect(drafts[0].isInstallment).toBe(false);
    expect(drafts[0].amount).toBe(1000);
  });

  // U12: totalValue=0 with downPayment=200 → empty drafts (Math.min caps dp to 0, no balance)
  test("U12: totalValue=0 with downPaymentValue=200 → empty drafts", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 200,
        totalValue: 0,
      }),
    });

    expect(drafts).toHaveLength(0);
  });

  // U13: downPaymentValue=totalValue=200 → only down_payment(200), no single
  test("U13: downPaymentValue=200 equals totalValue=200 → only down_payment(200), no single", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 200,
        totalValue: 200,
      }),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0].isDownPayment).toBe(true);
    expect(drafts[0].amount).toBe(200);
  });

  // U14: balance single draft should use downPaymentWallet
  test("U14: balance single draft wallet should be downPaymentWallet, not defaultWalletName", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 200,
        downPaymentWallet: "dp-wallet",
        totalValue: 1000,
      }),
    });

    expect(drafts).toHaveLength(2);
    const balance = drafts.find((d) => !d.isDownPayment);
    expect(balance!.wallet).toBe("dp-wallet");
  });

  // U15: proposalGroupId must be present on both down_payment and balance drafts
  test("U15: both down_payment and balance drafts should carry proposalGroupId", () => {
    const { drafts } = buildApprovedProposalTransactionDrafts({
      ...BASE_PARAMS,
      proposalData: makeProposalData({
        downPaymentEnabled: true,
        downPaymentType: "fixed",
        downPaymentValue: 200,
        totalValue: 1000,
      }),
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0].proposalGroupId).toBe("proposal_test-proposal-1");
    expect(drafts[1].proposalGroupId).toBe("proposal_test-proposal-1");
  });
});
