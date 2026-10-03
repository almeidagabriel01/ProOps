import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: unknown[][] = [];
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, name: string) => ({ collection: name }),
  query: (...args: unknown[]) => args,
  where: (...args: unknown[]) => {
    calls.push(["where", ...args]);
    return ["where", ...args];
  },
  limit: (n: number) => ["limit", n],
  doc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

import { serviceOrdersQuery } from "../field-service-service";

/**
 * As rules só deixam o técnico listar as OS se a consulta provar que cada uma
 * é dele (`technicianUids array-contains`). Sem o filtro, a lista inteira é
 * recusada e a tela dele fica vazia com erro de permissão.
 */
describe("consulta das OS", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("o técnico filtra por ele mesmo", () => {
    serviceOrdersQuery("t1", { seesAll: false, uid: "diego" });
    expect(calls).toEqual([
      ["where", "tenantId", "==", "t1"],
      ["where", "technicianUids", "array-contains", "diego"],
    ]);
  });

  it("quem vê a equipe inteira lê pelo tenant", () => {
    serviceOrdersQuery("t1", { seesAll: true, uid: "dono" });
    expect(calls).toEqual([["where", "tenantId", "==", "t1"]]);
  });
});
