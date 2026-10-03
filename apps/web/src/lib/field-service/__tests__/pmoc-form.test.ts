import { describe, expect, it } from "vitest";
import { buildPmocItems } from "../pmoc";
import { MAX_PMOC_ITEMS, newPmocItem, parseOptionalNumber, pmocItemsSummary, validatePmocForm } from "../pmoc-form";

describe("número opcional", () => {
  it.each([
    ["", false, null],
    ["  ", false, null],
    ["40", true, 40],
    ["1.200", true, 1200],
    ["320,5", false, 320.5],
    ["320,5", true, undefined],
    ["-3", false, undefined],
    ["abc", false, undefined],
  ])("%j (inteiro: %s) → %s", (value, integer, expected) => {
    expect(parseOptionalNumber(value, integer)).toBe(expected);
  });
});

describe("validação do PMOC", () => {
  const ok = { items: buildPmocItems(["Split"]), occupants: "", climatizedArea: "" };

  it("plano do modelo, sem números, passa", () => {
    expect(validatePmocForm(ok)).toEqual({});
  });

  it("sem itens, acima do teto ou com item vazio, não passa", () => {
    expect(validatePmocForm({ ...ok, items: [] }).items).toBeDefined();
    expect(
      validatePmocForm({ ...ok, items: Array.from({ length: MAX_PMOC_ITEMS + 1 }, () => ({ ...ok.items[0] })) }).items,
    ).toBeDefined();
    expect(validatePmocForm({ ...ok, items: [newPmocItem("split")] }).items).toBe("Descreva cada item do PMOC.");
  });

  it("ocupantes inteiros e área em número", () => {
    expect(validatePmocForm({ ...ok, occupants: "4,5" }).occupants).toBeDefined();
    expect(validatePmocForm({ ...ok, climatizedArea: "grande" }).climatizedArea).toBeDefined();
  });
});

it("item novo tem id próprio, que não colide com os da norma", () => {
  const a = newPmocItem("vrf", 1);
  const b = newPmocItem("vrf", 1);
  expect(a.id).toMatch(/^custom_/);
  expect(a.id).not.toBe(b.id);
  expect(a.id.length).toBeLessThanOrEqual(60);
  expect(a).toMatchObject({ category: "vrf", text: "", frequency: "monthly" });
});

it("resumo do plano por frequência", () => {
  expect(pmocItemsSummary([])).toBe("Nenhum item no plano.");
  const items = buildPmocItems(["Janela"]).filter((i) => i.category === "window");
  expect(pmocItemsSummary(items)).toBe("7 itens: 2 mensais, 2 trimestrais, 2 semestrais, 1 anual");
});
