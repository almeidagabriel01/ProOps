/**
 * O histórico da equipe: catálogo fechado, rótulo curto, TTL de um ano, e a
 * falha de gravação nunca derruba a ação que a gerou.
 */
const mockAdded: Array<Record<string, unknown>> = [];
let mockFail = false;
jest.mock("../../init", () => ({
  db: {
    collection: (name: string) =>
      name === "users"
        ? { doc: () => ({ get: async () => ({ data: () => ({ name: "Vendedora" }) }) }) }
        : {
            add: async (data: Record<string, unknown>) => {
              if (mockFail) throw new Error("quota");
              mockAdded.push(data);
            },
          },
  },
}));
jest.mock("firebase-admin/firestore", () => ({
  Timestamp: { fromMillis: (ms: number) => ({ ms }) },
}));
jest.mock("../logger", () => ({ logger: { warn: jest.fn() } }));

import { recordMemberAudit } from "../member-audit";

beforeEach(() => {
  mockAdded.length = 0;
  mockFail = false;
});

it("grava quem, o quê, o alvo e expira em 365 dias", async () => {
  const before = Date.now();
  await recordMemberAudit({
    tenantId: "t1",
    actorUid: "vend",
    action: "proposal_approved",
    target: { type: "proposal", id: "p1", label: "  Casa   Alphaville  " },
  });
  expect(mockAdded[0]).toMatchObject({
    tenantId: "t1",
    actorUid: "vend",
    actorName: "Vendedora",
    action: "proposal_approved",
    targetType: "proposal",
    targetId: "p1",
    targetLabel: "Casa Alphaville",
    details: null,
  });
  const ttl = (mockAdded[0].expiresAt as { ms: number }).ms - before;
  expect(ttl).toBeGreaterThanOrEqual(364 * 24 * 60 * 60 * 1000);
});

it("ação fora do catálogo não é gravada", async () => {
  await recordMemberAudit({
    tenantId: "t1",
    actorUid: "vend",
    action: "inventada" as never,
    target: { type: "proposal" },
  });
  expect(mockAdded).toHaveLength(0);
});

it("rótulo longo é cortado e detalhe que não é escalar é descartado", async () => {
  await recordMemberAudit({
    tenantId: "t1",
    actorUid: "vend",
    action: "wallet_adjusted",
    target: { type: "wallet", label: "x".repeat(500) },
    details: { amount: 10, nested: { a: 1 } as never },
  });
  expect(String(mockAdded[0].targetLabel)).toHaveLength(120);
  expect(mockAdded[0].details).toEqual({ amount: 10 });
});

it("falha ao gravar não lança", async () => {
  mockFail = true;
  await expect(
    recordMemberAudit({ tenantId: "t1", actorUid: "vend", action: "client_deleted", target: { type: "client" } }),
  ).resolves.toBeUndefined();
});
