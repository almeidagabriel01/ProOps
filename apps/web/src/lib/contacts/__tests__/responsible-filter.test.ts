import { describe, expect, it } from "vitest";
import {
  matchesResponsibleFilter,
  parseResponsibleFilter,
} from "@/lib/contacts/responsible-filter";

describe("parseResponsibleFilter", () => {
  it("'eu' vira quem está logado, e sem login não filtra", () => {
    expect(parseResponsibleFilter("eu", "ana")).toEqual({ kind: "member", id: "ana" });
    expect(parseResponsibleFilter("eu", null)).toEqual({ kind: "all" });
  });

  it("pessoa da equipe e parceiro", () => {
    expect(parseResponsibleFilter("m:beto", "ana")).toEqual({ kind: "member", id: "beto" });
    expect(parseResponsibleFilter("p:c9", "ana")).toEqual({ kind: "partner", id: "c9" });
  });

  it("vazio ou desconhecido não filtra", () => {
    for (const value of [null, undefined, "", "m:", "p:", "x:1", "qualquer"]) {
      expect(parseResponsibleFilter(value, "ana")).toEqual({ kind: "all" });
    }
  });
});

describe("matchesResponsibleFilter", () => {
  const record = { responsibleMemberId: "ana", partnerContactIds: ["c1", "c2"] };

  it("pessoa da equipe casa pelo responsável", () => {
    expect(matchesResponsibleFilter(record, { kind: "member", id: "ana" })).toBe(true);
    expect(matchesResponsibleFilter(record, { kind: "member", id: "beto" })).toBe(false);
  });

  it("parceiro casa por qualquer um da lista", () => {
    expect(matchesResponsibleFilter(record, { kind: "partner", id: "c2" })).toBe(true);
    expect(matchesResponsibleFilter(record, { kind: "partner", id: "c3" })).toBe(false);
  });

  it("registro sem responsável só aparece sem filtro", () => {
    expect(matchesResponsibleFilter({}, { kind: "all" })).toBe(true);
    expect(matchesResponsibleFilter({}, { kind: "member", id: "ana" })).toBe(false);
    expect(matchesResponsibleFilter({ partnerContactIds: null }, { kind: "partner", id: "c1" })).toBe(false);
  });
});
