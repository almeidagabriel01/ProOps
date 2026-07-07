/**
 * computeProposalSortFields — derivação dos campos desnormalizados de
 * ordenação — e getProposalsPaginated com sort primarySystem: sempre
 * server-side via orderBy (o branch de full-fetch + sort client-side foi
 * removido).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = {
  whereArgs: [] as unknown[][],
  orderByArgs: [] as unknown[][],
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
  orderBy: vi.fn((...args: unknown[]) => {
    captured.orderByArgs.push(args);
    return { __kind: "orderBy", args };
  }),
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
  captured.orderByArgs.length = 0;
  captured.limitArgs.length = 0;
  getDocsMock.mockReset();
});

describe("computeProposalSortFields", () => {
  it("deriva sistemas e ambientes aninhados, ordenados pt-BR e únicos", async () => {
    const { computeProposalSortFields } = await import("../proposal-service");
    const result = computeProposalSortFields({
      sistemas: [
        {
          sistemaId: "s2",
          sistemaName: "Som Ambiente",
          ambientes: [
            { ambienteId: "a2", ambienteName: "Sala" },
            { ambienteId: "a3", ambienteName: "Cozinha" },
          ],
        },
        {
          sistemaId: "s1",
          sistemaName: "Automação",
          ambientes: [{ ambienteId: "a1", ambienteName: "Sala" }],
        },
      ],
    });

    expect(result.primarySystem).toBe("Automação, Som Ambiente");
    expect(result.primaryEnvironment).toBe("Cozinha, Sala");
  });

  it("filtra sistema ambiente-like (seleção de ambiente) do primarySystem", async () => {
    const { computeProposalSortFields } = await import("../proposal-service");
    const result = computeProposalSortFields({
      sistemas: [
        {
          // ambiente-like: 1 ambiente com mesmo id/nome do sistema
          sistemaId: "amb-1",
          sistemaName: "Varanda",
          ambientes: [{ ambienteId: "amb-1", ambienteName: "Varanda" }],
        },
        {
          sistemaId: "s1",
          sistemaName: "Iluminação",
          ambientes: [{ ambienteId: "a1", ambienteName: "Quarto" }],
        },
      ],
    });

    expect(result.primarySystem).toBe("Iluminação");
    expect(result.primaryEnvironment).toBe("Quarto, Varanda");
  });

  it("proposta sem sistemas → strings vazias (mantém doc no índice)", async () => {
    const { computeProposalSortFields } = await import("../proposal-service");
    expect(computeProposalSortFields({})).toEqual({
      primarySystem: "",
      primaryEnvironment: "",
    });
    expect(computeProposalSortFields({ sistemas: [] })).toEqual({
      primarySystem: "",
      primaryEnvironment: "",
    });
  });

  it("faz fallback para campos primários já existentes quando sistemas está vazio", async () => {
    const { computeProposalSortFields } = await import("../proposal-service");
    const result = computeProposalSortFields({
      sistemas: [],
      primarySystem: "Legado",
      primaryEnvironment: "Sala Legada",
    });

    expect(result.primarySystem).toBe("Legado");
    expect(result.primaryEnvironment).toBe("Sala Legada");
  });

  it("suporta formato legado sem array ambientes (ambienteName direto)", async () => {
    const { computeProposalSortFields } = await import("../proposal-service");
    const result = computeProposalSortFields({
      sistemas: [
        {
          sistemaId: "s1",
          sistemaName: "Persianas",
          ambienteName: "Escritório",
        },
      ],
    });

    expect(result.primarySystem).toBe("Persianas");
    expect(result.primaryEnvironment).toBe("Escritório");
  });
});

describe("ProposalService.getProposalsPaginated — sort primarySystem", () => {
  it("usa orderBy server-side (sem full-fetch) e pagina com limit", async () => {
    getDocsMock.mockResolvedValueOnce(
      snap([
        { id: "p1", data: { title: "A", primarySystem: "Automação" } },
        { id: "p2", data: { title: "B", primarySystem: "Som" } },
      ]),
    );

    const { ProposalService } = await import("../proposal-service");
    const result = await ProposalService.getProposalsPaginated("t1", 12, null, {
      key: "primarySystem",
      direction: "asc",
    });

    // exatamente 1 query — o branch antigo baixava a coleção inteira sem orderBy
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(captured.orderByArgs).toContainEqual(["primarySystem", "asc"]);
    expect(captured.limitArgs).toContainEqual([13]); // pageSize + 1
    expect(captured.whereArgs).toContainEqual(["tenantId", "==", "t1"]);
    expect(result.data.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(result.hasMore).toBe(false);
  });

  it("usa orderBy também para primaryEnvironment desc", async () => {
    getDocsMock.mockResolvedValueOnce(snap([]));

    const { ProposalService } = await import("../proposal-service");
    await ProposalService.getProposalsPaginated("t1", 12, null, {
      key: "primaryEnvironment",
      direction: "desc",
    });

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(captured.orderByArgs).toContainEqual(["primaryEnvironment", "desc"]);
  });
});
