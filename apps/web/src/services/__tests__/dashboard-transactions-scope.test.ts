/**
 * Escopo de transações do dashboard — junto com getTransactionsScoped,
 * substitui o full-fetch: pagos no mês por paidAt + recentes com limit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  whereArgs: [] as unknown[][],
  orderByArgs: [] as unknown[][],
  limitArgs: [] as unknown[][],
};
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __kind: "collection" })),
  query: vi.fn((...args: unknown[]) => ({ __kind: "query", args })),
  where: vi.fn((...args: unknown[]) => {
    captured.whereArgs.push(args);
    return { __kind: "where", args };
  }),
  orderBy: vi.fn((...args: unknown[]) => {
    captured.orderByArgs.push(args);
    return { __kind: "orderBy", args };
  }),
  limit: vi.fn((...args: unknown[]) => {
    captured.limitArgs.push(args);
    return { __kind: "limit", args };
  }),
  startAfter: vi.fn(),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getDoc: vi.fn(),
  doc: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

function snap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

beforeEach(() => {
  captured.whereArgs.length = 0;
  captured.orderByArgs.length = 0;
  captured.limitArgs.length = 0;
  getDocsMock.mockReset();
});

describe("TransactionService.getTransactionsPaidBetween", () => {
  it("range de paidAt [start, end) tenant-scoped", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([{ id: "tx1", data: { status: "paid", paidAt: "2026-07-03T10:00:00Z" } }]),
    );

    const { TransactionService } = await import("../transaction-service");
    const result = await TransactionService.getTransactionsPaidBetween(
      "t1",
      "2026-07-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
    );

    expect(result.map((t) => t.id)).toEqual(["tx1"]);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.whereArgs).toContainEqual(["paidAt", ">=", "2026-07-01T00:00:00.000Z"]);
    expect(captured.whereArgs).toContainEqual(["paidAt", "<", "2026-08-01T00:00:00.000Z"]);
  });
});

describe("TransactionService.getRecentTransactions", () => {
  it("date desc, limit N, derived overdue aplicado", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        {
          id: "tx1",
          data: { status: "pending", date: "2020-01-01", dueDate: "2020-01-01" },
        },
      ]),
    );

    const { TransactionService } = await import("../transaction-service");
    const result = await TransactionService.getRecentTransactions("t1", 5);

    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.orderByArgs).toContainEqual(["date", "desc"]);
    expect(captured.limitArgs).toContainEqual([5]);
    expect(result[0].status).toBe("overdue"); // vencida há anos → derived
  });
});
