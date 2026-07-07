/**
 * Busca textual indexada via searchTokens — searchProposals e searchClients
 * consultam com tenantId + array-contains(primeira palavra normalizada) +
 * limit, e refinam client-side exigindo TODAS as palavras do termo. Nunca
 * baixam a coleção inteira.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  whereArgs: [] as unknown[][],
  limitArgs: [] as unknown[][],
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
  limit: vi.fn((...args: unknown[]) => {
    captured.limitArgs.push(args);
    return { __kind: "limit", args };
  }),
  startAfter: vi.fn(() => ({ __kind: "startAfter" })),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getDoc: vi.fn(),
  doc: vi.fn(),
  getCountFromServer: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

function snap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

beforeEach(() => {
  captured.whereArgs.length = 0;
  captured.limitArgs.length = 0;
  getDocsMock.mockReset();
});

describe("ProposalService.searchProposals", () => {
  it("consulta tenantId + array-contains(token normalizado) + limit", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([{ id: "p1", data: { title: "Proposta João", clientName: "João" } }]),
    );

    const { ProposalService } = await import("../proposal-service");
    const result = await ProposalService.searchProposals("t1", "João", 100);

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.whereArgs).toContainEqual([
      "searchTokens",
      "array-contains",
      "joao",
    ]);
    expect(captured.limitArgs).toContainEqual([100]);
    expect(result.map((p) => p.id)).toEqual(["p1"]);
  });

  it("refina client-side exigindo todas as palavras (title/clientName)", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        {
          id: "match",
          data: { title: "Casa da Praia", clientName: "Maria Silva" },
        },
        {
          id: "partial",
          data: { title: "Casa do Campo", clientName: "José" },
        },
      ]),
    );

    const { ProposalService } = await import("../proposal-service");
    const result = await ProposalService.searchProposals("t1", "casa maria");

    // "casa" bate nos dois; "maria" só no primeiro
    expect(result.map((p) => p.id)).toEqual(["match"]);
  });

  it("termo com menos de 2 chars não dispara query", async () => {
    const { ProposalService } = await import("../proposal-service");
    const result = await ProposalService.searchProposals("t1", "a");

    expect(result).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });

  it("trunca o token em 15 chars (mesmo cap de prefixo do backend)", async () => {
    getDocsMock.mockResolvedValueOnce(snap([]));

    const { ProposalService } = await import("../proposal-service");
    await ProposalService.searchProposals("t1", "abcdefghijklmnopqrst");

    expect(captured.whereArgs).toContainEqual([
      "searchTokens",
      "array-contains",
      "abcdefghijklmno",
    ]);
  });
});

describe("ClientService.searchClients", () => {
  it("consulta tenantId + array-contains + limit e refina em name/email/phone", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        {
          id: "c1",
          data: { name: "Ana Souza", email: "ana@x.com", phone: "119999" },
        },
        {
          id: "c2",
          data: { name: "Anderson", email: "and@x.com", phone: "118888" },
        },
      ]),
    );

    const { ClientService } = await import("../client-service");
    const result = await ClientService.searchClients("t1", "ana souza", 50);

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(captured.whereArgs).toContainEqual([
      "searchTokens",
      "array-contains",
      "ana",
    ]);
    expect(captured.limitArgs).toContainEqual([50]);
    // refino multi-palavra: "ana" + "souza" só no c1
    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("refina por email/phone além do nome", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        {
          id: "c1",
          data: { name: "Beatriz", email: "bia@empresa.com", phone: "1188" },
        },
      ]),
    );

    const { ClientService } = await import("../client-service");
    const result = await ClientService.searchClients("t1", "bia@empresa.com");

    expect(result.map((c) => c.id)).toEqual(["c1"]);
  });

  it("termo com menos de 2 chars não dispara query", async () => {
    const { ClientService } = await import("../client-service");
    const result = await ClientService.searchClients("t1", "b");

    expect(result).toEqual([]);
    expect(getDocsMock).not.toHaveBeenCalled();
  });
});
