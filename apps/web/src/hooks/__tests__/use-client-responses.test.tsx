// @vitest-environment jsdom
/**
 * Aceites e pedidos de mudança chegam ao vivo: a lista de propostas é lida uma
 * vez, e sem o listener o selo só aparecia depois de um F5.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

type Listener = {
  filters: string[];
  next: (snap: unknown) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
};

const fs = vi.hoisted(() => ({
  listeners: [] as Listener[],
  owner: null as null | { field: string; uid: string },
}));

vi.mock("@/lib/permissions/query-scope", () => ({ ownerFilter: async () => fs.owner }));

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  limit: () => "limit",
  where: (field: string, _op: string, value: string) => `${field}=${value}`,
  query: (_c: unknown, ...parts: string[]) => parts.filter((p) => p !== "limit"),
  onSnapshot: (filters: string[], next: (snap: unknown) => void) => {
    const unsubscribe = vi.fn();
    fs.listeners.push({ filters, next, unsubscribe });
    return unsubscribe;
  },
}));
vi.mock("@/services/proposal-service", () => ({
  mapProposalDoc: (d: { id: string; data: () => Record<string, unknown> }) => ({
    id: d.id,
    ...d.data(),
  }),
}));

import { useClientResponses } from "../use-client-responses";

const snap = (ids: string[]) => ({
  docs: ids.map((id) => ({ id, data: () => ({ title: id }) })),
});

beforeEach(() => {
  fs.listeners = [];
  fs.owner = null;
});

describe("useClientResponses", () => {
  it("escuta só o que está em aberto, filtrado pela empresa", async () => {
    renderHook(() => useClientResponses("t1"));
    await waitFor(() => expect(fs.listeners).toHaveLength(2));
    expect(fs.listeners.map((l) => l.filters)).toEqual([
      ["tenantId=t1", "clientAcceptance.status=pending"],
      ["tenantId=t1", "clientChangeRequest.status=open"],
    ]);
  });

  it("fica pronto quando os dois respondem, e atualiza com a tela aberta", async () => {
    const { result } = renderHook(() => useClientResponses("t1"));
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(fs.listeners).toHaveLength(2));

    act(() => {
      fs.listeners[0].next(snap([]));
      fs.listeners[1].next(snap([]));
    });
    expect(result.current.ready).toBe(true);
    expect(result.current.acceptances.size).toBe(0);

    act(() => fs.listeners[0].next(snap(["p1"])));
    expect(result.current.acceptances.has("p1")).toBe(true);

    act(() => fs.listeners[1].next(snap(["p2"])));
    expect(result.current.changeRequests.get("p2")).toMatchObject({ id: "p2" });
  });

  it("sem empresa não escuta nada; ao sair, desliga os listeners", async () => {
    renderHook(() => useClientResponses(undefined));
    expect(fs.listeners).toHaveLength(0);

    const { unmount } = renderHook(() => useClientResponses("t1"));
    await waitFor(() => expect(fs.listeners).toHaveLength(2));
    unmount();
    expect(fs.listeners.every((l) => l.unsubscribe.mock.calls.length === 1)).toBe(true);
  });

  it("quem vê só as próprias escuta só as propostas dela", async () => {
    fs.owner = { field: "sellerId", uid: "vend" };
    renderHook(() => useClientResponses("t1"));
    await waitFor(() => expect(fs.listeners).toHaveLength(2));
    expect(fs.listeners[0].filters).toEqual(["tenantId=t1", "sellerId=vend", "clientAcceptance.status=pending"]);
  });
});
