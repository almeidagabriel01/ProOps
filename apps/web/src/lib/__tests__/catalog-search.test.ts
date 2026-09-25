import { describe, expect, it } from "vitest";
import { filterCatalogItems } from "../catalog-search";

const ITENS = [
  { id: "1", name: "Módulo de Iluminação", category: "Automação", manufacturer: "Sonoff" },
  { id: "2", name: "Cortina Rolô", category: "Cortinas", manufacturer: "Hunter" },
  { id: "3", name: "Instalação", category: "Serviços" },
];

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe("filterCatalogItems", () => {
  it("termo vazio devolve tudo", () => {
    expect(ids(filterCatalogItems(ITENS, "   "))).toEqual(["1", "2", "3"]);
  });

  it("ignora acento e caixa", () => {
    expect(ids(filterCatalogItems(ITENS, "ILUMINACAO"))).toEqual(["1"]);
  });

  it("procura também na categoria e no fabricante", () => {
    expect(ids(filterCatalogItems(ITENS, "hunter"))).toEqual(["2"]);
    expect(ids(filterCatalogItems(ITENS, "servicos"))).toEqual(["3"]);
  });

  it("exige todas as palavras, em qualquer campo", () => {
    expect(ids(filterCatalogItems(ITENS, "modulo sonoff"))).toEqual(["1"]);
    expect(ids(filterCatalogItems(ITENS, "modulo hunter"))).toEqual([]);
  });
});
