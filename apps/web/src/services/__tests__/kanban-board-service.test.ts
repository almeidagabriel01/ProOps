/**
 * KanbanBoardService — o board CRM NUNCA baixa a coleção inteira: cada
 * coluna carrega páginas limitadas (limit + startAfter) filtradas por
 * tenantId + status, e o total do header vem de aggregation
 * (getCountFromServer).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  whereArgs: [] as unknown[][],
  orderByArgs: [] as unknown[][],
  limitArgs: [] as unknown[],
  startAfterArgs: [] as unknown[],
};
const getDocsMock = vi.fn();
const getCountFromServerMock = vi.fn();

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
  limit: vi.fn((n: unknown) => {
    captured.limitArgs.push(n);
    return { __kind: "limit", n };
  }),
  startAfter: vi.fn((cursor: unknown) => {
    captured.startAfterArgs.push(cursor);
    return { __kind: "startAfter", cursor };
  }),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getCountFromServer: (...args: unknown[]) =>
    getCountFromServerMock(...args),
  getDoc: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

function snap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

function countSnap(count: number) {
  return { data: () => ({ count }) };
}

beforeEach(() => {
  captured.whereArgs.length = 0;
  captured.orderByArgs.length = 0;
  captured.limitArgs.length = 0;
  captured.startAfterArgs.length = 0;
  getDocsMock.mockReset();
  getCountFromServerMock.mockReset();
});

describe("KanbanBoardService.getProposalColumnPage", () => {
  it("consulta tenantId + status único + orderBy createdAt desc + limit 30", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([{ id: "p1", data: { status: "sent", title: "A" } }]),
    );

    const { KanbanBoardService } = await import("../kanban-board-service");
    const page = await KanbanBoardService.getProposalColumnPage("t1", [
      "sent",
    ]);

    expect(page.items.map((p) => p.id)).toEqual(["p1"]);
    expect(page.hasMore).toBe(false); // página incompleta (1 < 30)
    expect(page.cursor).not.toBeNull();
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.whereArgs).toContainEqual(["status", "==", "sent"]);
    expect(captured.orderByArgs).toContainEqual(["createdAt", "desc"]);
    expect(captured.limitArgs).toEqual([30]);
  });

  it("usa where in para múltiplos statuses (id da coluna + mappedStatus), com dedupe", async () => {
    getDocsMock.mockResolvedValueOnce(snap([]));

    const { KanbanBoardService } = await import("../kanban-board-service");
    const page = await KanbanBoardService.getProposalColumnPage("t1", [
      "col-abc",
      "sent",
      "sent",
    ]);

    expect(page.items).toEqual([]);
    expect(page.cursor).toBeNull();
    expect(page.hasMore).toBe(false);
    expect(captured.whereArgs).toContainEqual([
      "status",
      "in",
      ["col-abc", "sent"],
    ]);
  });

  it("pagina com startAfter(cursor) e sinaliza hasMore quando a página vem cheia", async () => {
    const docs = Array.from({ length: 2 }, (_, i) => ({
      id: `p${i}`,
      data: { status: "sent" },
    }));
    getDocsMock.mockResolvedValueOnce(snap(docs));

    const { KanbanBoardService } = await import("../kanban-board-service");
    const fakeCursor = { __kind: "docSnap" };
    const page = await KanbanBoardService.getProposalColumnPage(
      "t1",
      ["sent"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cursor opaco no teste
      { cursor: fakeCursor as any, pageSize: 2 },
    );

    expect(captured.startAfterArgs).toEqual([fakeCursor]);
    expect(captured.limitArgs).toEqual([2]);
    expect(page.hasMore).toBe(true); // página cheia (2 === pageSize)
    expect(page.items).toHaveLength(2);
  });

  it("converte Timestamps de createdAt/updatedAt para ISO string", async () => {
    const ts = (iso: string) => ({ toDate: () => new Date(iso) });
    getDocsMock.mockResolvedValueOnce(
      snap([
        {
          id: "p1",
          data: {
            status: "sent",
            createdAt: ts("2026-01-02T03:04:05.000Z"),
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
        },
      ]),
    );

    const { KanbanBoardService } = await import("../kanban-board-service");
    const page = await KanbanBoardService.getProposalColumnPage("t1", [
      "sent",
    ]);

    expect(page.items[0].createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(page.items[0].updatedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(page.items[0].clientName).toBe("");
  });

  it("sem statuses ou sem tenant, retorna vazio sem consultar o Firestore", async () => {
    const { KanbanBoardService } = await import("../kanban-board-service");

    const emptyStatuses = await KanbanBoardService.getProposalColumnPage(
      "t1",
      [],
    );
    const emptyTenant = await KanbanBoardService.getProposalColumnPage("", [
      "sent",
    ]);

    expect(emptyStatuses).toEqual({ items: [], cursor: null, hasMore: false });
    expect(emptyTenant).toEqual({ items: [], cursor: null, hasMore: false });
    expect(getDocsMock).not.toHaveBeenCalled();
  });
});

describe("KanbanBoardService.countProposalColumn", () => {
  it("conta via aggregation com filtros de igualdade (tenantId + status in)", async () => {
    getCountFromServerMock.mockResolvedValueOnce(countSnap(42));

    const { KanbanBoardService } = await import("../kanban-board-service");
    const total = await KanbanBoardService.countProposalColumn("t1", [
      "col-abc",
      "sent",
    ]);

    expect(total).toBe(42);
    expect(getCountFromServerMock).toHaveBeenCalledTimes(1);
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.whereArgs).toContainEqual([
      "status",
      "in",
      ["col-abc", "sent"],
    ]);
    expect(captured.orderByArgs).toEqual([]); // count não usa orderBy
  });

  it("retorna 0 sem statuses, sem chamar aggregation", async () => {
    const { KanbanBoardService } = await import("../kanban-board-service");
    expect(await KanbanBoardService.countProposalColumn("t1", [])).toBe(0);
    expect(getCountFromServerMock).not.toHaveBeenCalled();
  });
});

describe("KanbanBoardService.getTransactionColumnPage", () => {
  it("consulta tenantId + status + orderBy date desc + limit 30 e deriva overdue", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        {
          id: "tx1",
          data: { status: "pending", date: "2020-01-01", dueDate: "2020-01-15" },
        },
        {
          id: "tx2",
          data: { status: "pending", date: "2099-01-01", dueDate: "2099-01-15" },
        },
      ]),
    );

    const { KanbanBoardService } = await import("../kanban-board-service");
    const page = await KanbanBoardService.getTransactionColumnPage(
      "t1",
      "pending",
    );

    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.whereArgs).toContainEqual(["status", "==", "pending"]);
    expect(captured.orderByArgs).toContainEqual(["date", "desc"]);
    expect(captured.limitArgs).toEqual([30]);
    // dueDate no passado → derivado como overdue (mesma regra de getTransactions)
    expect(page.items.find((t) => t.id === "tx1")?.status).toBe("overdue");
    expect(page.items.find((t) => t.id === "tx2")?.status).toBe("pending");
    expect(page.hasMore).toBe(false);
  });

  it("pagina com startAfter e retorna cursor da última doc", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        { id: "tx1", data: { status: "paid", date: "2026-07-01" } },
        { id: "tx2", data: { status: "paid", date: "2026-06-01" } },
      ]),
    );

    const { KanbanBoardService } = await import("../kanban-board-service");
    const fakeCursor = { __kind: "docSnap" };
    const page = await KanbanBoardService.getTransactionColumnPage(
      "t1",
      "paid",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cursor opaco no teste
      { cursor: fakeCursor as any, pageSize: 2 },
    );

    expect(captured.startAfterArgs).toEqual([fakeCursor]);
    expect(page.hasMore).toBe(true);
    expect(
      (page.cursor as unknown as { id: string } | null)?.id,
    ).toBe("tx2");
  });
});

describe("KanbanBoardService.countTransactionColumn", () => {
  it("conta via aggregation por status", async () => {
    getCountFromServerMock.mockResolvedValueOnce(countSnap(7));

    const { KanbanBoardService } = await import("../kanban-board-service");
    const total = await KanbanBoardService.countTransactionColumn(
      "t1",
      "overdue",
    );

    expect(total).toBe(7);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.whereArgs).toContainEqual(["status", "==", "overdue"]);
  });

  it("retorna 0 sem tenant, sem chamar aggregation", async () => {
    const { KanbanBoardService } = await import("../kanban-board-service");
    expect(await KanbanBoardService.countTransactionColumn("", "paid")).toBe(0);
    expect(getCountFromServerMock).not.toHaveBeenCalled();
  });
});
