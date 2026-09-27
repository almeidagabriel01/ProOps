import { describe, expect, it } from "vitest";
import {
  hasOpenChangeRequest,
  hasPendingAcceptance,
  isAcceptancePending,
  pickApprovedColumnId,
} from "../client-acceptance";

describe("isAcceptancePending", () => {
  it("só o aceite pendente conta", () => {
    expect(isAcceptancePending({ clientAcceptance: { name: "a", document: "1", acceptedAt: "x", status: "pending" } })).toBe(true);
    for (const status of ["confirmed", "discarded", "invalidated"] as const) {
      expect(isAcceptancePending({ clientAcceptance: { name: "a", document: "1", acceptedAt: "x", status } })).toBe(false);
    }
    expect(isAcceptancePending({ clientAcceptance: { name: "a", document: "1", acceptedAt: "x" } })).toBe(false);
    expect(isAcceptancePending({})).toBe(false);
  });
});

describe("pickApprovedColumnId", () => {
  it("colunas padrão: a mapeada como aprovada", () => {
    expect(
      pickApprovedColumnId([
        { id: "default_0", mappedStatus: "in_progress", category: "open" },
        { id: "default_2", mappedStatus: "approved", category: "won" },
      ]),
    ).toBe("default_2");
  });

  it("funil personalizado sem mapeamento: a primeira coluna ganha na ordem do quadro", () => {
    expect(
      pickApprovedColumnId([
        { id: "fechado-b", order: 5, category: "won" },
        { id: "fechado-a", order: 3, category: "won" },
        { id: "aberto", order: 1, category: "open" },
      ]),
    ).toBe("fechado-a");
  });

  it("sem coluna nenhuma cai no status aprovado", () => {
    expect(pickApprovedColumnId([])).toBe("approved");
  });
});

describe("selos ao vivo", () => {
  const live = (acc: string[], chg: string[]) => ({
    ready: true,
    acceptances: new Map(acc.map((id) => [id, {}])),
    changeRequests: new Map(chg.map((id) => [id, {}])),
  });

  it("com o listener pronto, ele manda, mesmo com a lista velha", () => {
    const stale = { id: "p1", clientAcceptance: null, clientChangeRequest: null };
    expect(hasPendingAcceptance(stale, live(["p1"], []))).toBe(true);
    expect(hasOpenChangeRequest(stale, live([], ["p1"]))).toBe(true);

    const resolvedMeanwhile = {
      id: "p2",
      clientAcceptance: { name: "a", document: "1", acceptedAt: "x", status: "pending" as const },
      clientChangeRequest: { name: null, message: "m", requestedAt: "x", status: "open" as const },
    };
    expect(hasPendingAcceptance(resolvedMeanwhile, live([], []))).toBe(false);
    expect(hasOpenChangeRequest(resolvedMeanwhile, live([], []))).toBe(false);
  });

  it("antes do listener responder, vale o dado da proposta", () => {
    const notReady = { ready: false, acceptances: new Map(), changeRequests: new Map() };
    const p = {
      id: "p1",
      clientChangeRequest: { name: null, message: "m", requestedAt: "x", status: "open" as const },
    };
    expect(hasOpenChangeRequest(p, notReady)).toBe(true);
    expect(hasPendingAcceptance(p, notReady)).toBe(false);
  });
});
