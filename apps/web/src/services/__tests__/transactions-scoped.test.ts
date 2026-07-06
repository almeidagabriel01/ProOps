/**
 * getTransactionsScoped — a página financeira NUNCA mais baixa a coleção
 * inteira: escopo = itens em aberto + período (dueDate e date) + grupos
 * completados, com dedupe por id.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  whereArgs: [] as unknown[][],
};
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({ __kind: "collection" })),
  query: vi.fn((...args: unknown[]) => ({ __kind: "query", args })),
  where: vi.fn((...args: unknown[]) => {
    captured.whereArgs.push(args);
    return { __kind: "where", args };
  }),
  orderBy: vi.fn(() => ({ __kind: "orderBy" })),
  limit: vi.fn(() => ({ __kind: "limit" })),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getDoc: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

function snap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

beforeEach(() => {
  captured.whereArgs.length = 0;
  getDocsMock.mockReset();
});

describe("TransactionService.getTransactionsScoped", () => {
  it("une abertos + período (dueDate e date), deduplica e completa grupos", async () => {
    getDocsMock
      // 1: abertos (pending/overdue)
      .mockResolvedValueOnce(
        snap([
          {
            id: "open-1",
            data: { date: "2026-05-10", status: "pending", installmentGroupId: "g1" },
          },
        ]),
      )
      // 2: range de dueDate
      .mockResolvedValueOnce(
        snap([{ id: "due-1", data: { date: "2026-07-02", status: "paid" } }]),
      )
      // 3: range de date — inclui duplicata de open-1 (mesmos dados, mesmo doc)
      .mockResolvedValueOnce(
        snap([
          {
            id: "open-1",
            data: { date: "2026-05-10", status: "pending", installmentGroupId: "g1" },
          },
          { id: "date-1", data: { date: "2026-07-03", status: "paid" } },
        ]),
      )
      // 4: completar grupo g1 (installmentGroupId in [...])
      .mockResolvedValueOnce(
        snap([
          {
            id: "sibling-1",
            data: { date: "2026-09-01", status: "paid", installmentGroupId: "g1" },
          },
        ]),
      );

    const { TransactionService } = await import("../transaction-service");
    const result = await TransactionService.getTransactionsScoped("t1", {
      start: "2026-07-01",
      end: "2026-07-31",
    });

    const ids = result.map((t) => t.id).sort();
    expect(ids).toEqual(["date-1", "due-1", "open-1", "sibling-1"]);

    expect(captured.whereArgs).toContainEqual(["status", "in", ["pending", "overdue"]]);
    expect(captured.whereArgs).toContainEqual(["dueDate", ">=", "2026-07-01"]);
    expect(captured.whereArgs).toContainEqual(["dueDate", "<=", "2026-07-31"]);
    expect(captured.whereArgs).toContainEqual(["date", ">=", "2026-07-01"]);
    expect(captured.whereArgs).toContainEqual(["date", "<=", "2026-07-31"]);
    expect(captured.whereArgs).toContainEqual(["installmentGroupId", "in", ["g1"]]);
    // toda query é tenant-scoped (regra de segurança multi-tenant)
    const tenantFilters = captured.whereArgs.filter(
      (a) => a[0] === "tenantId" && a[1] === "==" && a[2] === "t1",
    );
    expect(tenantFilters.length).toBeGreaterThanOrEqual(4);
  });

  it("sem grupos no escopo, não faz queries extras", async () => {
    getDocsMock
      .mockResolvedValueOnce(snap([]))
      .mockResolvedValueOnce(
        snap([{ id: "x", data: { date: "2026-07-05", status: "paid" } }]),
      )
      .mockResolvedValueOnce(snap([]));

    const { TransactionService } = await import("../transaction-service");
    const result = await TransactionService.getTransactionsScoped("t1", {
      start: "2026-07-01",
      end: "2026-07-31",
    });

    expect(result.map((t) => t.id)).toEqual(["x"]);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
  });
});
