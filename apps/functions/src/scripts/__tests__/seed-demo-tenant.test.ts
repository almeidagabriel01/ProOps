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
      proposals: 3,
    });
  });

  test("every non-tenant doc is tagged with tenantId demo", async () => {
    await seedDemoTenant();
    // The first set() is the tenant doc itself (keyed by id, no tenantId field).
    const [, ...contentWrites] = set.mock.calls;
    expect(contentWrites.length).toBe(19); // 4 + 3 + 3 + 3 + 3 + 3
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
        expect(li.total).toBe(li.unitPrice * li.quantity);
        expect(li.ambienteInstanceId).toContain("-");
        computed += li.total;
      }
      expect(data.totalValue).toBe(computed);
      expect(data.totalValue).toBeGreaterThan(0);
    }
  });
});
