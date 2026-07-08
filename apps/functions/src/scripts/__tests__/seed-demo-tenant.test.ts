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
      proposals: 3,
    });
  });

  test("every non-tenant doc is tagged with tenantId demo", async () => {
    await seedDemoTenant();
    // The first set() is the tenant doc itself (keyed by id, no tenantId field).
    const [, ...contentWrites] = set.mock.calls;
    expect(contentWrites.length).toBe(13); // 4 + 3 + 3 + 3
    for (const [, data] of contentWrites) {
      expect(data.tenantId).toBe(DEMO_TENANT_ID);
    }
  });

  test("demo proposals reference demo products via sistemas/ambientes", async () => {
    await seedDemoTenant();
    const proposalWrites = set.mock.calls.filter(
      ([ref]) => typeof ref.id === "string" && ref.id.startsWith("proposals/"),
    );
    expect(proposalWrites.length).toBe(3);
    for (const [, data] of proposalWrites) {
      expect(Array.isArray(data.sistemas)).toBe(true);
      expect(data.sistemas.length).toBeGreaterThan(0);
      const productIds = data.sistemas.flatMap((s: { ambientes: { productIds: string[] }[] }) =>
        s.ambientes.flatMap((a) => a.productIds),
      );
      expect(productIds.length).toBeGreaterThan(0);
      for (const pid of productIds) {
        expect(pid.startsWith("demo_prod_")).toBe(true);
      }
    }
  });
});
