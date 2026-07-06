/**
 * Contagens server-side do dashboard — o dashboard NÃO baixa mais todas as
 * propostas e clientes: usa aggregation count() + 5 recentes com limit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  whereArgs: [] as unknown[][],
  orderByArgs: [] as unknown[][],
  limitArgs: [] as unknown[][],
};
const getCountFromServerMock = vi.fn();
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ __kind: "collection", name })),
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
  getCountFromServer: (...args: unknown[]) => getCountFromServerMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getDoc: vi.fn(),
  doc: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((d: Date) => ({ __kind: "timestamp", ms: d.getTime() })),
  },
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

const countResult = (count: number) => ({ data: () => ({ count }) });

beforeEach(() => {
  captured.whereArgs.length = 0;
  captured.orderByArgs.length = 0;
  captured.limitArgs.length = 0;
  getCountFromServerMock.mockReset();
  getDocsMock.mockReset();
});

describe("ProposalService counts", () => {
  it("countProposalsByStatuses deduplica, faz chunks de 30 e soma", async () => {
    getCountFromServerMock
      .mockResolvedValueOnce(countResult(10))
      .mockResolvedValueOnce(countResult(5));

    const { ProposalService } = await import("../proposal-service");
    const statuses = [
      ...Array.from({ length: 35 }, (_, i) => `status-${i}`),
      "status-0", // duplicado — não deve virar 3º chunk
    ];
    const total = await ProposalService.countProposalsByStatuses("t1", statuses);

    expect(total).toBe(15);
    expect(getCountFromServerMock).toHaveBeenCalledTimes(2); // 35 únicos → 2 chunks
    const inClauses = captured.whereArgs.filter((a) => a[1] === "in");
    expect(inClauses[0][2]).toHaveLength(30);
    expect(inClauses[1][2]).toHaveLength(5);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
  });

  it("countProposalsByStatuses com lista vazia → 0 sem query", async () => {
    const { ProposalService } = await import("../proposal-service");
    expect(await ProposalService.countProposalsByStatuses("t1", [])).toBe(0);
    expect(getCountFromServerMock).not.toHaveBeenCalled();
  });

  it("getRecentProposals: tenant-scoped, createdAt desc, limit N", async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [{ id: "p1", data: () => ({ title: "A" }) }],
    });

    const { ProposalService } = await import("../proposal-service");
    const result = await ProposalService.getRecentProposals("t1", 5);

    expect(result.map((p) => p.id)).toEqual(["p1"]);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.orderByArgs).toContainEqual(["createdAt", "desc"]);
    expect(captured.limitArgs).toContainEqual([5]);
  });
});

describe("ClientService counts", () => {
  it("countClientsCreatedBetween soma contagens de Timestamp e string ISO (createdAt misto)", async () => {
    getCountFromServerMock
      .mockResolvedValueOnce(countResult(3)) // docs com Timestamp
      .mockResolvedValueOnce(countResult(2)); // docs com string ISO

    const { ClientService } = await import("../client-service");
    const start = new Date("2026-07-01T00:00:00Z");
    const end = new Date("2026-08-01T00:00:00Z");
    const total = await ClientService.countClientsCreatedBetween("t1", start, end);

    expect(total).toBe(5);
    expect(getCountFromServerMock).toHaveBeenCalledTimes(2);
    // range por Timestamp
    expect(captured.whereArgs).toContainEqual([
      "createdAt",
      ">=",
      { __kind: "timestamp", ms: start.getTime() },
    ]);
    // range por string ISO
    expect(captured.whereArgs).toContainEqual([
      "createdAt",
      ">=",
      start.toISOString(),
    ]);
    const tenantFilters = captured.whereArgs.filter(
      (a) => a[0] === "tenantId" && a[2] === "t1",
    );
    expect(tenantFilters.length).toBe(2);
  });

  it("countClients conta por tenant", async () => {
    getCountFromServerMock.mockResolvedValueOnce(countResult(42));
    const { ClientService } = await import("../client-service");
    expect(await ClientService.countClients("t1")).toBe(42);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
  });
});
