/**
 * Excluir um produto baixava TODAS as propostas do tenant para ver se ele
 * estava em uso. Agora a checagem usa `productRefs` com limit(1), e só cai no
 * método antigo enquanto houver proposta do tenant sem o índice.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const whereArgs: unknown[][] = [];
const limitArgs: unknown[][] = [];
const getDocsMock = vi.fn();
const countMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((...args: unknown[]) => ({ args })),
  where: vi.fn((...args: unknown[]) => {
    whereArgs.push(args);
    return { where: args };
  }),
  limit: vi.fn((...args: unknown[]) => {
    limitArgs.push(args);
    return { limit: args };
  }),
  orderBy: vi.fn(),
  startAfter: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: (...a: unknown[]) => getDocsMock(...a),
  getCountFromServer: (...a: unknown[]) => countMock(...a),
  Timestamp: { fromDate: vi.fn() },
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

import { ProposalService } from "../proposal-service";

const count = (n: number) => ({ data: () => ({ count: n }) });

beforeEach(() => {
  whereArgs.length = 0;
  limitArgs.length = 0;
  getDocsMock.mockReset();
  countMock.mockReset();
});

describe("isProductUsedInProposal", () => {
  it("tenant todo indexado: uma consulta com array-contains e limit(1)", async () => {
    countMock.mockResolvedValueOnce(count(40)).mockResolvedValueOnce(count(40));
    getDocsMock.mockResolvedValueOnce({ empty: false, docs: [{}] });

    await expect(ProposalService.isProductUsedInProposal("p1", "t1")).resolves.toBe(true);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(whereArgs).toContainEqual(["productRefs", "array-contains", "product:p1"]);
    expect(limitArgs).toContainEqual([1]);
  });

  it("serviço usa a chave service:", async () => {
    countMock.mockResolvedValue(count(3));
    getDocsMock.mockResolvedValueOnce({ empty: true, docs: [] });
    await expect(ProposalService.isProductUsedInProposal("s1", "t1", "service")).resolves.toBe(false);
    expect(whereArgs).toContainEqual(["productRefs", "array-contains", "service:s1"]);
  });

  it("antes do backfill (contagens diferentes) cai na varredura e ainda acha o uso", async () => {
    countMock.mockResolvedValueOnce(count(10)).mockResolvedValueOnce(count(7));
    getDocsMock.mockResolvedValueOnce({
      empty: false,
      docs: [
        { data: () => ({ products: [{ productId: "p9" }] }) },
        { data: () => ({ products: [{ productId: "p1", itemType: "product" }] }) },
      ],
    });
    await expect(ProposalService.isProductUsedInProposal("p1", "t1")).resolves.toBe(true);
    expect(whereArgs).not.toContainEqual(["productRefs", "array-contains", "product:p1"]);
  });

  it("falha na verificação bloqueia a exclusão", async () => {
    countMock.mockRejectedValueOnce(new Error("offline"));
    await expect(ProposalService.isProductUsedInProposal("p1", "t1")).resolves.toBe(true);
  });
});

describe("isClientUsedInProposal", () => {
  it("consulta com limit(1)", async () => {
    getDocsMock.mockResolvedValueOnce({ empty: true, docs: [] });
    await expect(ProposalService.isClientUsedInProposal("c1", "t1")).resolves.toBe(false);
    expect(limitArgs).toContainEqual([1]);
  });
});
