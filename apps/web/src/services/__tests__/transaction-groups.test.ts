/**
 * Fonte da aba Agrupados: resumos paginados de transaction_groups, avulsos
 * paginados (grouped == false) e membros on-demand ao expandir. Tudo
 * tenant-scoped.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  whereArgs: [] as unknown[][],
  orderByArgs: [] as unknown[][],
  limitArgs: [] as unknown[][],
  startAfterArgs: [] as unknown[][],
  collections: [] as string[],
};
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => {
    captured.collections.push(name);
    return { __kind: "collection", name };
  }),
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
  startAfter: vi.fn((...args: unknown[]) => {
    captured.startAfterArgs.push(args);
    return { __kind: "startAfter", args };
  }),
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
  captured.orderByArgs.length = 0;
  captured.limitArgs.length = 0;
  captured.startAfterArgs.length = 0;
  captured.collections.length = 0;
  getDocsMock.mockReset();
});

describe("TransactionService.getGroupSummariesPaginated", () => {
  it("pagina resumos por lastDueDate desc, tenant-scoped, com cursor quando página cheia", async () => {
    const rawDocs = [
      {
        id: "group_g1",
        data: { tenantId: "t1", groupKey: "group:g1", lastDueDate: "2026-09-01" },
      },
      {
        id: "proposal_p1",
        data: { tenantId: "t1", groupKey: "proposal:p1", lastDueDate: "2026-08-01" },
      },
    ];
    getDocsMock.mockResolvedValueOnce(snap(rawDocs));

    const { TransactionService } = await import("../transaction-service");
    const { groups, nextCursor } =
      await TransactionService.getGroupSummariesPaginated("t1", {
        pageSize: 2,
      });

    expect(groups.map((g) => g.id)).toEqual(["group_g1", "proposal_p1"]);
    expect(captured.collections).toContain("transaction_groups");
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.orderByArgs).toContainEqual(["lastDueDate", "desc"]);
    expect(captured.limitArgs).toContainEqual([2]);
    expect(nextCursor).not.toBeNull(); // página cheia → há próxima
  });

  it("página parcial → nextCursor null; cursor é repassado via startAfter", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        {
          id: "group_g9",
          data: { tenantId: "t1", groupKey: "group:g9", lastDueDate: "2026-01-01" },
        },
      ]),
    );

    const { TransactionService } = await import("../transaction-service");
    const fakeCursor = { __kind: "docSnap" };
    const { nextCursor } = await TransactionService.getGroupSummariesPaginated(
      "t1",
      { pageSize: 50, cursor: fakeCursor as never },
    );

    expect(captured.startAfterArgs).toContainEqual([fakeCursor]);
    expect(nextCursor).toBeNull();
  });
});

describe("TransactionService.getStandaloneTransactionsPaginated", () => {
  it("pagina avulsos (grouped == false) por date desc com derived overdue", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        {
          id: "tx1",
          data: {
            tenantId: "t1",
            grouped: false,
            date: "2020-01-01",
            dueDate: "2020-01-01", // muito no passado → derived overdue
            status: "pending",
          },
        },
      ]),
    );

    const { TransactionService } = await import("../transaction-service");
    const { transactions, nextCursor } =
      await TransactionService.getStandaloneTransactionsPaginated("t1", {
        pageSize: 50,
      });

    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.whereArgs).toContainEqual(["grouped", "==", false]);
    expect(captured.orderByArgs).toContainEqual(["date", "desc"]);
    expect(transactions[0].status).toBe("overdue");
    expect(nextCursor).toBeNull();
  });
});

describe("TransactionService.getGroupMembers", () => {
  it("chave group: → união de installment e recurring, dedupe, ordenado por installmentNumber", async () => {
    getDocsMock
      // installmentGroupId == g1
      .mockResolvedValueOnce(
        snap([
          {
            id: "tx2",
            data: { tenantId: "t1", installmentGroupId: "g1", installmentNumber: 2 },
          },
          {
            id: "tx1",
            data: { tenantId: "t1", installmentGroupId: "g1", installmentNumber: 1 },
          },
        ]),
      )
      // recurringGroupId == g1 (vazio)
      .mockResolvedValueOnce(snap([]));

    const { TransactionService } = await import("../transaction-service");
    const members = await TransactionService.getGroupMembers("t1", "group:g1");

    expect(members.map((m) => m.id)).toEqual(["tx1", "tx2"]);
    expect(captured.whereArgs).toContainEqual(["installmentGroupId", "==", "g1"]);
    expect(captured.whereArgs).toContainEqual(["recurringGroupId", "==", "g1"]);
    const tenantFilters = captured.whereArgs.filter(
      (a) => a[0] === "tenantId" && a[2] === "t1",
    );
    expect(tenantFilters.length).toBeGreaterThanOrEqual(2);
  });

  it("chave proposal: → busca por proposalGroupId + irmãos legados do mesmo installmentGroupId", async () => {
    getDocsMock
      // proposalGroupId == p1
      .mockResolvedValueOnce(
        snap([
          {
            id: "tx1",
            data: {
              tenantId: "t1",
              proposalGroupId: "p1",
              installmentGroupId: "g1",
              installmentNumber: 1,
            },
          },
        ]),
      )
      // irmãos legados: installmentGroupId == g1 (inclui tx1 de novo → dedupe)
      .mockResolvedValueOnce(
        snap([
          {
            id: "tx1",
            data: {
              tenantId: "t1",
              proposalGroupId: "p1",
              installmentGroupId: "g1",
              installmentNumber: 1,
            },
          },
          {
            id: "tx2",
            data: { tenantId: "t1", installmentGroupId: "g1", installmentNumber: 2 },
          },
        ]),
      );

    const { TransactionService } = await import("../transaction-service");
    const members = await TransactionService.getGroupMembers("t1", "proposal:p1");

    expect(members.map((m) => m.id)).toEqual(["tx1", "tx2"]);
    expect(captured.whereArgs).toContainEqual(["proposalGroupId", "==", "p1"]);
    expect(captured.whereArgs).toContainEqual(["installmentGroupId", "==", "g1"]);
  });
});
