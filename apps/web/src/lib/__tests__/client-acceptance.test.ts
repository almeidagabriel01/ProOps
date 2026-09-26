import { describe, expect, it } from "vitest";
import { isAcceptancePending, pickApprovedColumnId } from "../client-acceptance";

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
