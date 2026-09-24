/**
 * As contagens de limite do plano (produto, proposta, contato e membro) rodam
 * a cada criação em plano com teto. Elas baixavam a coleção inteira do tenant
 * só para ler `.size`; agora têm que ser aggregation `count()`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const whereArgs: unknown[][] = [];
const getCountFromServerMock = vi.fn();
const getDocsMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  query: vi.fn((col: { name: string }, ...clauses: unknown[]) => ({
    col: col.name,
    clauses,
  })),
  where: vi.fn((...args: unknown[]) => {
    whereArgs.push(args);
    return args;
  }),
  getCountFromServer: (...args: unknown[]) => getCountFromServerMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { countTenantDocs, countTenantMembers } from "../plan-usage-counts";

beforeEach(() => {
  whereArgs.length = 0;
  getCountFromServerMock.mockReset();
  getDocsMock.mockReset();
  getCountFromServerMock.mockResolvedValue({ data: () => ({ count: 42 }) });
});

describe("countTenantDocs", () => {
  it.each(["proposals", "clients", "products"] as const)(
    "%s: conta por aggregation, filtrada pelo tenant, sem baixar documentos",
    async (name) => {
      await expect(countTenantDocs(name, "t1")).resolves.toBe(42);
      expect(getDocsMock).not.toHaveBeenCalled();
      expect(getCountFromServerMock).toHaveBeenCalledTimes(1);
      expect(getCountFromServerMock.mock.calls[0][0]).toMatchObject({ col: name });
      expect(whereArgs).toEqual([["tenantId", "==", "t1"]]);
    },
  );
});

describe("countTenantMembers", () => {
  it("conta só os MEMBER do tenant, por aggregation", async () => {
    await expect(countTenantMembers("t1")).resolves.toBe(42);
    expect(getDocsMock).not.toHaveBeenCalled();
    expect(getCountFromServerMock.mock.calls[0][0]).toMatchObject({ col: "users" });
    expect(whereArgs).toEqual([
      ["tenantId", "==", "t1"],
      ["role", "==", "MEMBER"],
    ]);
  });
});
