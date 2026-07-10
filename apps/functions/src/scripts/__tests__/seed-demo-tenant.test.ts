/**
 * Unit test for the demo-tenant seed: verifies every seeded document is tagged
 * with the shared `demo` tenantId and that the batch is committed once
 * (idempotent, deterministic doc IDs).
 */

const set = jest.fn();
const commit = jest.fn().mockResolvedValue(undefined);
const doc = jest.fn((id: string) => ({ id }));
const collection = jest.fn((name: string) => ({ doc: (id: string) => doc(`${name}/${id}`) }));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    batch: () => ({ set, commit }),
    collection: (name: string) => collection(name),
  }),
  Timestamp: {
    fromMillis: (ms: number) => ({ __ts: ms, toDate: () => new Date(ms) }),
  },
}));
jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { seedDemoTenant, DEMO_TENANT_ID } from "../seed-demo-tenant";

describe("seedDemoTenant", () => {
  beforeEach(() => {
    set.mockClear();
    commit.mockClear();
    doc.mockClear();
    collection.mockClear();
  });

  test("commits once and returns the expected counts", async () => {
    const result = await seedDemoTenant();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      tenant: 1,
      products: 4,
      services: 3,
      clients: 3,
      ambientes: 3,
      sistemas: 3,
      options: 11,
      proposals: 3,
      wallets: 2,
      transactions: 16,
    });
  });

  test("every non-tenant doc is tagged with tenantId demo", async () => {
    await seedDemoTenant();
    // The first set() is the tenant doc itself (keyed by id, no tenantId field).
    const [, ...contentWrites] = set.mock.calls;
    expect(contentWrites.length).toBe(48); // 4+3+3+3+3+11+3 + 2 wallets + 16 transactions
    for (const [, data] of contentWrites) {
      expect(data.tenantId).toBe(DEMO_TENANT_ID);
    }
  });

  test("seeds sistemas and ambientes so Soluções renders", async () => {
    await seedDemoTenant();
    const sistemaWrites = set.mock.calls.filter(
      ([ref]) => typeof ref.id === "string" && ref.id.startsWith("sistemas/"),
    );
    const ambienteWrites = set.mock.calls.filter(
      ([ref]) => typeof ref.id === "string" && ref.id.startsWith("ambientes/"),
    );
    expect(sistemaWrites.length).toBe(3);
    expect(ambienteWrites.length).toBe(3);
    // Each sistema groups ambientes carrying product lines.
    for (const [, data] of sistemaWrites) {
      expect(Array.isArray(data.ambientes)).toBe(true);
      expect(data.ambientes.length).toBeGreaterThan(0);
      for (const amb of data.ambientes) {
        expect(amb.products.length).toBeGreaterThan(0);
        expect(amb.products[0].productId.startsWith("demo_prod_")).toBe(true);
      }
    }
  });

  test("demo proposals have priced line items and are not draft", async () => {
    await seedDemoTenant();
    const proposalWrites = set.mock.calls.filter(
      ([ref]) => typeof ref.id === "string" && ref.id.startsWith("proposals/"),
    );
    expect(proposalWrites.length).toBe(3);
    for (const [, data] of proposalWrites) {
      // View route blocks draft — demo proposals must be sent/approved.
      expect(["sent", "approved"]).toContain(data.status);
      // Money lives in products[] (line items), not just sistemas[].
      expect(Array.isArray(data.products)).toBe(true);
      expect(data.products.length).toBeGreaterThan(0);
      let computed = 0;
      for (const li of data.products) {
        expect(li.productId.startsWith("demo_prod_")).toBe(true);
        expect(typeof li.unitPrice).toBe("number");
        // The form filters products per environment by systemInstanceId — it
        // MUST be present and equal to ambienteInstanceId (`${sys}-${amb}`).
        expect(li.systemInstanceId).toBe(li.ambienteInstanceId);
        expect(li.systemInstanceId).toContain("-");
        computed += li.total;
      }
      expect(data.totalValue).toBe(computed);
      expect(data.totalValue).toBeGreaterThan(0);
    }
  });

  test("seeds wallets and standalone transactions for Financeiro/Dashboard", async () => {
    await seedDemoTenant();

    const walletWrites = set.mock.calls.filter(
      ([ref]) => typeof ref.id === "string" && ref.id.startsWith("wallets/"),
    );
    const txnWrites = set.mock.calls.filter(
      ([ref]) => typeof ref.id === "string" && ref.id.startsWith("transactions/"),
    );
    expect(walletWrites.length).toBe(2);
    expect(txnWrites.length).toBe(16);

    for (const [, data] of txnWrites) {
      expect(data.tenantId).toBe(DEMO_TENANT_ID);
      expect(typeof data.amount).toBe("number");
      expect(["income", "expense"]).toContain(data.type);
      expect(["paid", "pending", "overdue"]).toContain(data.status);
      // Standalone (not proposal-linked) so the avulsos query returns them.
      expect(data.grouped).toBe(false);
      expect(String(data.wallet).startsWith("demo_wallet_")).toBe(true);
    }

    // wallet.balance is denormalized and must equal the sum of paid impacts
    // (income +, expense -) on that wallet — mirroring getWalletImpacts.
    const expected: Record<string, number> = {};
    for (const [, t] of txnWrites) {
      if (t.status === "paid") {
        expected[t.wallet] =
          (expected[t.wallet] ?? 0) +
          (t.type === "income" ? t.amount : -t.amount);
      }
    }
    for (const [ref, w] of walletWrites) {
      const id = (ref.id as string).replace("wallets/", "");
      expect(w.status).toBe("active");
      expect(typeof w.balance).toBe("number");
      expect(w.balance).toBe(expected[id] ?? 0);
    }

    // Parcelas: membros agrupados por installmentGroupId, com números 1..N.
    const byGroup: Record<string, number[]> = {};
    for (const [, t] of txnWrites) {
      if (t.isInstallment) {
        expect(typeof t.installmentGroupId).toBe("string");
        expect(t.installmentCount).toBeGreaterThan(1);
        (byGroup[t.installmentGroupId] ??= []).push(t.installmentNumber);
      }
    }
    const groups = Object.values(byGroup);
    expect(groups.length).toBe(2); // 1 receita 3x + 1 despesa 3x
    for (const numbers of groups) {
      expect(numbers.sort((a, b) => a - b)).toEqual([1, 2, 3]);
    }
  });
});
