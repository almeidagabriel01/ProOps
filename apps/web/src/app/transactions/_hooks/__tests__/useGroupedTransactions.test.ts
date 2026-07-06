// @vitest-environment jsdom
/**
 * useGroupedTransactions — fonte da aba Agrupados: resumos + avulsos
 * paginados, membros on-demand com cache em memória (Map — NUNCA
 * cookie/localStorage), invalidação via refresh().
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const getGroupSummariesPaginated = vi.fn();
const getStandaloneTransactionsPaginated = vi.fn();
const getGroupMembers = vi.fn();

vi.mock("@/services/transaction-service", () => ({
  TransactionService: {
    getGroupSummariesPaginated: (...args: unknown[]) =>
      getGroupSummariesPaginated(...args),
    getStandaloneTransactionsPaginated: (...args: unknown[]) =>
      getStandaloneTransactionsPaginated(...args),
    getGroupMembers: (...args: unknown[]) => getGroupMembers(...args),
  },
}));

import { useGroupedTransactions } from "../useGroupedTransactions";

const summary = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  tenantId: "t1",
  groupKey: `group:${id}`,
  kind: "installment",
  type: "expense",
  description: id,
  memberCount: 2,
  paidCount: 0,
  total: 100,
  paidTotal: 0,
  pendingTotal: 100,
  nextDueDate: "2026-08-01",
  firstDueDate: "2026-07-01",
  lastDueDate: "2026-09-01",
  status: "pending",
  updatedAt: "2026-07-06T00:00:00Z",
  ...over,
});

const tx = (id: string) => ({
  id,
  tenantId: "t1",
  type: "expense",
  description: id,
  amount: 10,
  date: "2026-07-01",
  status: "pending",
  createdAt: "",
  updatedAt: "",
});

beforeEach(() => {
  getGroupSummariesPaginated.mockReset();
  getStandaloneTransactionsPaginated.mockReset();
  getGroupMembers.mockReset();
});

describe("useGroupedTransactions", () => {
  it("desabilitado ou sem tenant → não busca nada", async () => {
    const { result } = renderHook(() =>
      useGroupedTransactions({ tenantId: "t1", enabled: false }),
    );
    await act(async () => {});
    expect(getGroupSummariesPaginated).not.toHaveBeenCalled();
    expect(getStandaloneTransactionsPaginated).not.toHaveBeenCalled();
    expect(result.current.groupSummaries).toEqual([]);
  });

  it("habilitado → carrega primeira página de resumos e avulsos em paralelo", async () => {
    getGroupSummariesPaginated.mockResolvedValueOnce({
      groups: [summary("g1")],
      nextCursor: { __c: 1 },
    });
    getStandaloneTransactionsPaginated.mockResolvedValueOnce({
      transactions: [tx("s1")],
      nextCursor: null,
    });

    const { result } = renderHook(() =>
      useGroupedTransactions({ tenantId: "t1", enabled: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groupSummaries.map((g) => g.id)).toEqual(["g1"]);
    expect(result.current.standalone.map((t) => t.id)).toEqual(["s1"]);
    expect(result.current.hasMore).toBe(true); // resumos ainda têm cursor
  });

  it("loadMore anexa próxima página só das fontes com cursor", async () => {
    getGroupSummariesPaginated
      .mockResolvedValueOnce({ groups: [summary("g1")], nextCursor: { __c: 1 } })
      .mockResolvedValueOnce({ groups: [summary("g2")], nextCursor: null });
    getStandaloneTransactionsPaginated.mockResolvedValueOnce({
      transactions: [],
      nextCursor: null,
    });

    const { result } = renderHook(() =>
      useGroupedTransactions({ tenantId: "t1", enabled: true }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.groupSummaries.map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(result.current.hasMore).toBe(false);
    // avulsos sem cursor → não refaz query
    expect(getStandaloneTransactionsPaginated).toHaveBeenCalledTimes(1);
  });

  it("ensureMembers busca uma vez e cacheia (re-expandir = cache, sem query)", async () => {
    getGroupSummariesPaginated.mockResolvedValue({ groups: [], nextCursor: null });
    getStandaloneTransactionsPaginated.mockResolvedValue({
      transactions: [],
      nextCursor: null,
    });
    getGroupMembers.mockResolvedValue([tx("m1"), tx("m2")]);

    const { result } = renderHook(() =>
      useGroupedTransactions({ tenantId: "t1", enabled: true }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let members: unknown;
    await act(async () => {
      members = await result.current.ensureMembers("group:g1");
    });
    expect((members as { id: string }[]).map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(result.current.getCachedMembers("group:g1")).toBeDefined();

    await act(async () => {
      await result.current.ensureMembers("group:g1");
    });
    expect(getGroupMembers).toHaveBeenCalledTimes(1);
  });

  it("refresh refaz as listas e REVALIDA membros cacheados (sem esvaziar expandidos)", async () => {
    getGroupSummariesPaginated.mockResolvedValue({
      groups: [summary("g1")],
      nextCursor: null,
    });
    getStandaloneTransactionsPaginated.mockResolvedValue({
      transactions: [tx("s1")],
      nextCursor: null,
    });
    getGroupMembers
      .mockResolvedValueOnce([tx("m1")])
      .mockResolvedValueOnce([tx("m1"), tx("m2")]); // pós-mutação

    const { result } = renderHook(() =>
      useGroupedTransactions({ tenantId: "t1", enabled: true }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.ensureMembers("group:g1");
    });
    expect(result.current.getCachedMembers("group:g1")).toHaveLength(1);

    await act(async () => {
      await result.current.refresh();
    });

    // membros revalidados no lugar — nunca undefined durante o refresh
    expect(result.current.getCachedMembers("group:g1")).toHaveLength(2);
    expect(getGroupMembers).toHaveBeenCalledTimes(2);
    // listas refeitas (1 fetch inicial + 1 do refresh)
    expect(getGroupSummariesPaginated).toHaveBeenCalledTimes(2);
    expect(getStandaloneTransactionsPaginated).toHaveBeenCalledTimes(2);
  });
});
