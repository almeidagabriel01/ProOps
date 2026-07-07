/**
 * Guards de custo Firestore client-side (auditoria 2026-07-06):
 * - o listener realtime de notificações DEVE ter limit(50) — roda em toda
 *   página autenticada e sem cap re-cobra a coleção inteira a cada mudança;
 * - transações relacionadas por grupo DEVEM ser buscadas por query
 *   direcionada (installmentGroupId/recurringGroupId), nunca via fetch da
 *   coleção inteira do tenant.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  queryArgs: [] as unknown[][],
  whereArgs: [] as unknown[][],
  limitArgs: [] as unknown[][],
};

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __kind: "collection" })),
  query: vi.fn((...args: unknown[]) => {
    captured.queryArgs.push(args);
    return { __kind: "query" };
  }),
  where: vi.fn((...args: unknown[]) => {
    captured.whereArgs.push(args);
    return { __kind: "where", args };
  }),
  orderBy: vi.fn(() => ({ __kind: "orderBy" })),
  limit: vi.fn((...args: unknown[]) => {
    captured.limitArgs.push(args);
    return { __kind: "limit", args };
  }),
  onSnapshot: vi.fn(() => vi.fn()),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDoc: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: { now: vi.fn() },
}));

vi.mock("@/lib/firebase", () => ({ db: {} }));

const callApiMock = vi.fn();
vi.mock("@/lib/api-client", () => ({
  callApi: (...args: unknown[]) =>
    (callApiMock as (...a: unknown[]) => unknown)(...args),
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => {
  captured.queryArgs.length = 0;
  captured.whereArgs.length = 0;
  captured.limitArgs.length = 0;
  vi.clearAllMocks();
});

describe("NotificationService.subscribe", () => {
  it("caps the realtime listener query at 50 docs", async () => {
    const { NotificationService } = await import("../notification-service");

    const unsubscribe = NotificationService.subscribe(
      { kind: "tenant", tenantId: "t1" } as never,
      () => undefined,
    );

    expect(captured.limitArgs).toContainEqual([50]);
    const queryWithLimit = captured.queryArgs.find((args) =>
      args.some(
        (a) => (a as { __kind?: string } | null)?.__kind === "limit",
      ),
    );
    expect(queryWithLimit).toBeDefined();
    unsubscribe();
  });
});

describe("TransactionService group queries", () => {
  it("getRecurringByGroupId queries by recurringGroupId (targeted, not full-tenant)", async () => {
    const { TransactionService } = await import("../transaction-service");

    await TransactionService.getRecurringByGroupId("group-9", "t1");

    expect(captured.whereArgs).toContainEqual([
      "recurringGroupId",
      "==",
      "group-9",
    ]);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
  });

  it("getInstallmentsByGroupId queries by installmentGroupId", async () => {
    const { TransactionService } = await import("../transaction-service");

    await TransactionService.getInstallmentsByGroupId("group-3", "t1");

    expect(captured.whereArgs).toContainEqual([
      "installmentGroupId",
      "==",
      "group-3",
    ]);
  });
});

describe("TransactionService.getSummary", () => {
  it("chama o endpoint agregado e NUNCA baixa a coleção via Firestore", async () => {
    callApiMock.mockResolvedValue({
      success: true,
      summary: {
        totalIncome: 10,
        totalExpense: 5,
        pendingIncome: 2,
        pendingExpense: 1,
      },
    });
    const { TransactionService } = await import("../transaction-service");
    const { getDocs } = await import("firebase/firestore");

    const summary = await TransactionService.getSummary("t1");

    expect(summary).toEqual({
      totalIncome: 10,
      totalExpense: 5,
      pendingIncome: 2,
      pendingExpense: 1,
    });
    expect(callApiMock).toHaveBeenCalledWith(
      "v1/transactions/summary?tenantId=t1",
      "GET",
    );
    expect(getDocs).not.toHaveBeenCalled();
  });
});
