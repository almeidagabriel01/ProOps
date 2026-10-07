/**
 * "Só os meus" nas consultas: o provedor publica o alcance na renderização, e
 * o service espera por ele enquanto as permissões carregam. Montar a consulta
 * antes disso pediria uma lista que as rules recusam inteira.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  ownerFilter,
  publishViewerScope,
  resetViewerScope,
  transactionScope,
  transactionScopeWhere,
} from "../query-scope";

afterEach(() => resetViewerScope());

describe("ownerFilter", () => {
  it("sem provedor, vê tudo", async () => {
    expect(await ownerFilter("proposals")).toBeNull();
    expect(await transactionScope()).toBe("all");
  });

  it("com 'own', filtra pelo campo do dono de cada coleção", async () => {
    publishViewerScope({ uid: "vend", byPage: { proposals: "own", clients: "own", kanban: "all" } });
    expect(await ownerFilter("proposals")).toEqual({ field: "sellerId", uid: "vend" });
    expect(await ownerFilter("clients")).toEqual({ field: "responsibleMemberId", uid: "vend" });
    expect(await ownerFilter("kanban")).toBeNull();
  });

  it("Lançamentos: 'mine' filtra pelo vendedor e 'income' pelo tipo", async () => {
    publishViewerScope({ uid: "vend", byPage: { transactions: "mine" } });
    expect(await ownerFilter("transactions")).toEqual({ field: "sellerId", uid: "vend" });
    expect(await transactionScopeWhere()).toHaveLength(1);
    publishViewerScope({ uid: "vend", byPage: { transactions: "income" } });
    expect(await ownerFilter("transactions")).toBeNull();
    expect(await transactionScope()).toBe("income");
    expect(await transactionScopeWhere()).toHaveLength(1);
  });

  it("enquanto as permissões carregam, espera o alcance em vez de supor 'all'", async () => {
    publishViewerScope(null);
    const pending = ownerFilter("proposals");
    publishViewerScope({ uid: "vend", byPage: { proposals: "own" } });
    expect(await pending).toEqual({ field: "sellerId", uid: "vend" });
  });
});
