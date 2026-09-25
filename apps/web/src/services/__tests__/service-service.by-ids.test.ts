/**
 * A visualização da proposta atualizava os itens baixando o catálogo inteiro
 * de produtos e serviços. `getServicesByIds` busca só os serviços da proposta.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocsMock = vi.fn();
const whereArgs: unknown[][] = [];

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => {
    whereArgs.push(args);
    return args;
  }),
  documentId: vi.fn(() => "__id__"),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  doc: vi.fn(),
  getDoc: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

import { ServiceService } from "../service-service";

beforeEach(() => {
  whereArgs.length = 0;
  getDocsMock.mockReset();
  getDocsMock.mockResolvedValue({ docs: [] });
});

describe("ServiceService.getServicesByIds", () => {
  it("sem ids não consulta nada", async () => {
    await expect(ServiceService.getServicesByIds("t1", [])).resolves.toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it("deduplica e divide em lotes de 30, sempre filtrando pelo tenant", async () => {
    const ids = Array.from({ length: 65 }, (_, i) => `s${i}`);
    await ServiceService.getServicesByIds("t1", [...ids, "s0", " s1 "]);
    expect(getDocsMock).toHaveBeenCalledTimes(3);
    const inArgs = whereArgs.filter((a) => a[1] === "in").map((a) => (a[2] as string[]).length);
    expect(inArgs).toEqual([30, 30, 5]);
    expect(whereArgs.filter((a) => a[0] === "tenantId" && a[2] === "t1")).toHaveLength(3);
  });
});
