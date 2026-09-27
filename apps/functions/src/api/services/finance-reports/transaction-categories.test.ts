jest.mock("../../../init", () => ({ db: {} }));

import { DEFAULT_CATEGORIES, buildInitialCategories, suggestGroup, withProposalCategory } from "./transaction-categories";

describe("grupo sugerido para a categoria que a empresa já usava", () => {
  it.each([
    ["Simples Nacional", "expense", "deduction"],
    ["ISS", "expense", "deduction"],
    ["ISS retido", "expense", "deduction"],
    ["DAS", "expense", "deduction"],
    // A comissão automática dos parceiros ("Comissao") contém "iss": não é imposto.
    ["Comissao", "expense", "operating"],
    ["Comissões de venda", "expense", "operating"],
    ["Permissão de uso", "expense", "operating"],
    ["Fornecedores", "expense", "cost"],
    ["Mão de obra", "expense", "cost"],
    ["Tarifas", "expense", "other_expense"],
    ["Aluguel", "expense", "operating"],
    ["Rendimentos", "income", "other_income"],
    ["Projetos", "income", "revenue"],
  ] as const)("%s (%s) vai para %s", (name, kind, group) => {
    expect(suggestGroup(name, kind)).toBe(group);
  });
});

describe("lista inicial", () => {
  it("as usadas primeiro, sem repetir as padrão com outra grafia", () => {
    const items = buildInitialCategories([
      { name: "vendas", kind: "income", group: "revenue" },
      { name: "Fornecedores", kind: "expense", group: "cost" },
    ]);
    const names = items.map((c) => `${c.kind}:${c.name}`);
    expect(names.slice(0, 2)).toEqual(["income:vendas", "expense:Fornecedores"]);
    // "Vendas" padrão não entra de novo; o resto das padrão entra.
    expect(names.filter((n) => n.toLowerCase() === "income:vendas")).toHaveLength(1);
    expect(items).toHaveLength(2 + DEFAULT_CATEGORIES.length - 1);
    expect(new Set(items.map((c) => c.id)).size).toBe(items.length);
  });

  it("mesmo nome em receita e despesa são duas categorias", () => {
    const items = buildInitialCategories([
      { name: "Serviços", kind: "expense", group: "operating" },
    ]);
    expect(items.filter((c) => c.name === "Serviços").map((c) => c.kind).sort()).toEqual(["expense", "income"]);
  });
});

describe("Propostas na lista", () => {
  it("lista antiga ganha Propostas, em Receita bruta", () => {
    const next = withProposalCategory([{ id: "a", name: "Vendas", kind: "income", group: "revenue" }]);
    expect(next?.map((c) => [c.name, c.kind, c.group])).toEqual([
      ["Vendas", "income", "revenue"],
      ["Propostas", "income", "revenue"],
    ]);
  });

  it("quem já tem (com outra grafia ou outro grupo) fica como está", () => {
    expect(withProposalCategory([{ id: "a", name: "propostas", kind: "income", group: "other_income" }])).toBeNull();
  });

  it("despesa chamada Propostas não conta", () => {
    expect(withProposalCategory([{ id: "a", name: "Propostas", kind: "expense", group: "operating" }])).not.toBeNull();
  });
});
