/**
 * getTransactionsSummary — summary financeiro via aggregation:
 * - 2 aggregations (income/expense) sobre paidTotal/pendingTotal;
 * - tenant SEMPRE do auth context para não-superadmin (param ignorado);
 * - superadmin pode consultar outro tenant via param (impersonation).
 */

const aggregateGetMock = jest.fn();
const whereChain = {
  where: jest.fn(),
  aggregate: jest.fn(() => ({ get: aggregateGetMock })),
};
whereChain.where.mockReturnValue(whereChain);

jest.mock("../../init", () => ({
  db: {
    collection: jest.fn(() => whereChain),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  AggregateField: { sum: jest.fn((field: string) => ({ field })) },
}));

const resolveUserAndTenantMock = jest.fn();
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: (...args: unknown[]) => resolveUserAndTenantMock(...args),
}));

import { getTransactionsSummary } from "./transaction-summary.service";

beforeEach(() => {
  jest.clearAllMocks();
  whereChain.where.mockReturnValue(whereChain);
  whereChain.aggregate.mockReturnValue({ get: aggregateGetMock });
});

describe("getTransactionsSummary", () => {
  it("mapeia as 2 aggregations para o shape do summary", async () => {
    resolveUserAndTenantMock.mockResolvedValue({
      tenantId: "t1",
      isSuperAdmin: false,
    });
    aggregateGetMock
      .mockResolvedValueOnce({ data: () => ({ paid: 1000, pending: 250 }) }) // income
      .mockResolvedValueOnce({ data: () => ({ paid: 400, pending: 80 }) }); // expense

    const summary = await getTransactionsSummary("uid-1", { uid: "uid-1" });

    expect(summary).toEqual({
      totalIncome: 1000,
      pendingIncome: 250,
      totalExpense: 400,
      pendingExpense: 80,
    });
    expect(whereChain.where).toHaveBeenCalledWith("tenantId", "==", "t1");
    expect(whereChain.where).toHaveBeenCalledWith("type", "==", "income");
    expect(whereChain.where).toHaveBeenCalledWith("type", "==", "expense");
  });

  it("não-superadmin: param tenantId é IGNORADO (usa o do auth context)", async () => {
    resolveUserAndTenantMock.mockResolvedValue({
      tenantId: "t-own",
      isSuperAdmin: false,
    });
    aggregateGetMock.mockResolvedValue({ data: () => ({ paid: 0, pending: 0 }) });

    await getTransactionsSummary("uid-1", { uid: "uid-1" }, "t-OUTRO");

    expect(whereChain.where).toHaveBeenCalledWith("tenantId", "==", "t-own");
    expect(whereChain.where).not.toHaveBeenCalledWith("tenantId", "==", "t-OUTRO");
  });

  it("superadmin: pode consultar tenant solicitado", async () => {
    resolveUserAndTenantMock.mockResolvedValue({
      tenantId: "",
      isSuperAdmin: true,
    });
    aggregateGetMock.mockResolvedValue({ data: () => ({ paid: 0, pending: 0 }) });

    await getTransactionsSummary("uid-sa", { uid: "uid-sa" }, "t-alvo");

    expect(whereChain.where).toHaveBeenCalledWith("tenantId", "==", "t-alvo");
  });

  it("sem tenant resolvível → AUTH_CLAIMS_MISSING_TENANT", async () => {
    resolveUserAndTenantMock.mockResolvedValue({
      tenantId: "",
      isSuperAdmin: true,
    });

    await expect(
      getTransactionsSummary("uid-sa", { uid: "uid-sa" }),
    ).rejects.toThrow("AUTH_CLAIMS_MISSING_TENANT");
  });

  it("valores não-numéricos do aggregate viram 0", async () => {
    resolveUserAndTenantMock.mockResolvedValue({
      tenantId: "t1",
      isSuperAdmin: false,
    });
    aggregateGetMock.mockResolvedValue({
      data: () => ({ paid: undefined, pending: null }),
    });

    const summary = await getTransactionsSummary("uid-1", { uid: "uid-1" });
    expect(summary).toEqual({
      totalIncome: 0,
      pendingIncome: 0,
      totalExpense: 0,
      pendingExpense: 0,
    });
  });
});
