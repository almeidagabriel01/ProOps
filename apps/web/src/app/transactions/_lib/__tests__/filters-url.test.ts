import { describe, expect, it } from "vitest";
import {
  parseTransactionFilters,
  serializeTransactionFilters,
  type TransactionFiltersState,
} from "../filters-url";

const base: TransactionFiltersState = {
  searchTerm: "",
  filterType: "all",
  filterStatus: ["pending", "overdue"],
  filterWallet: "",
  filterStartDate: "",
  filterEndDate: "",
  filterDateType: "dueDate",
  sortBy: "created",
  viewMode: "byDueDate",
};

describe("serializeTransactionFilters", () => {
  it("o padrão da tela não aparece no endereço", () => {
    const params = serializeTransactionFilters(base);
    expect(Object.values(params).every((v) => v === null)).toBe(true);
  });

  it("status todos vira 'todos' na Lista, e é o padrão em Agrupados", () => {
    expect(serializeTransactionFilters({ ...base, filterStatus: [] }).status).toBe("todos");
    expect(
      serializeTransactionFilters({ ...base, viewMode: "grouped", filterStatus: [] }).status,
    ).toBeNull();
  });

  it("guarda busca, tipo, carteira, período e ordem", () => {
    expect(
      serializeTransactionFilters({
        ...base,
        searchTerm: " aluguel ",
        filterType: "expense",
        filterStatus: ["paid"],
        filterWallet: "w1",
        filterStartDate: "2026-09-01",
        filterEndDate: "2026-09-30",
        filterDateType: "date",
        sortBy: "date",
      }),
    ).toEqual({
      view: null,
      q: "aluguel",
      tipo: "expense",
      status: "paid",
      carteira: "w1",
      de: "2026-09-01",
      ate: "2026-09-30",
      campo: "date",
      ordem: "date",
    });
  });
});

describe("parseTransactionFilters", () => {
  it("ida e volta preserva o estado", () => {
    const state: TransactionFiltersState = {
      ...base,
      searchTerm: "aluguel",
      filterType: "income",
      filterStatus: ["paid", "overdue"],
      filterWallet: "w1",
      filterStartDate: "2026-09-01",
      filterEndDate: "2026-09-30",
      filterDateType: "date",
      sortBy: "date",
      viewMode: "grouped",
    };
    const params = new URLSearchParams();
    Object.entries(serializeTransactionFilters(state)).forEach(([k, v]) => {
      if (v !== null) params.set(k, v);
    });
    expect({ ...base, ...parseTransactionFilters(params) }).toEqual(state);
  });

  it("ignora valores inválidos", () => {
    const parsed = parseTransactionFilters(
      new URLSearchParams("view=kanban&tipo=x&status=foo&de=ontem&campo=x&ordem=x"),
    );
    expect(parsed).toEqual({});
  });

  it("status=todos é a escolha explícita de ver todos", () => {
    expect(parseTransactionFilters(new URLSearchParams("status=todos")).filterStatus).toEqual([]);
  });
});
