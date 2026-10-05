import { describe, expect, it } from "vitest";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import { TENANT_NICHES } from "@/lib/niches/registry";
import type { ProjectItem } from "@/types/project";
import {
  applyItemOverlay,
  countProjectItems,
  dropFromItemOverlay,
  filterProjectItems,
  formatProjectItemMeasure,
  formatProjectItemQuantity,
  groupProjectItems,
  pruneItemOverlay,
} from "../project-items";

const item = (id: string, over: Partial<ProjectItem> = {}): ProjectItem => ({
  id,
  productId: `prod_${id}`,
  name: `Item ${id}`,
  manufacturer: null,
  quantity: 1,
  groupName: "Iluminação",
  placeName: "Sala",
  measure: null,
  status: "pending",
  statusAt: null,
  statusBy: null,
  statusByName: null,
  ...over,
});

describe("countProjectItems", () => {
  it("instalados x pendentes: em estoque e compra solicitada ainda são pendentes", () => {
    const counts = countProjectItems([
      item("a", { status: "installed" }),
      item("b", { status: "in_stock" }),
      item("c", { status: "purchase_requested" }),
      item("d"),
    ]);
    expect(counts).toMatchObject({ total: 4, installed: 1, pending: 3, percent: 25 });
    expect(counts.byStatus).toEqual({ pending: 1, purchase_requested: 1, in_stock: 1, installed: 1 });
  });

  it("lista vazia não divide por zero", () => {
    expect(countProjectItems([])).toMatchObject({ total: 0, installed: 0, pending: 0, percent: 0 });
  });
});

describe("filterProjectItems", () => {
  const items = [item("a", { status: "installed" }), item("b", { status: "in_stock" }), item("c")];
  it("pendentes são os não instalados; instalados, só os instalados", () => {
    expect(filterProjectItems(items, "pending").map((i) => i.id)).toEqual(["b", "c"]);
    expect(filterProjectItems(items, "installed").map((i) => i.id)).toEqual(["a"]);
    expect(filterProjectItems(items, "all")).toHaveLength(3);
  });
});

describe("groupProjectItems", () => {
  it("agrupa por grupo e local, na ordem da proposta, e a linha sem local vai para o fim", () => {
    const groups = groupProjectItems([
      item("solta", { groupName: null, placeName: null }),
      item("a", { placeName: "Sala" }),
      item("b", { placeName: "Cozinha" }),
      item("c", { placeName: "Sala" }),
      item("d", { groupName: "Áudio", placeName: "Sala" }),
    ]);
    expect(groups.map((g) => [g.groupName, g.placeName, g.items.map((i) => i.id)])).toEqual([
      ["Iluminação", "Sala", ["a", "c"]],
      ["Iluminação", "Cozinha", ["b"]],
      ["Áudio", "Sala", ["d"]],
      [null, null, ["solta"]],
    ]);
  });

  it("na proposta por local o grupo é o próprio local, e o nome não se repete", () => {
    const [group] = groupProjectItems([item("a", { groupName: "Suíte", placeName: "Suíte" })]);
    expect(group).toMatchObject({ groupName: null, placeName: "Suíte" });
  });
});

describe("formatProjectItemMeasure por nicho", () => {
  const rolo = item("rolo", { measure: { mode: "curtain_meter", width: 1.8, height: 2.4, panels: 2 }, quantity: 2 });
  const wave = item("wave", { measure: { mode: "curtain_height", width: 3.2, maxHeight: 3, panels: 1 } });
  const tubo = item("tubo", { measure: { mode: "curtain_width", width: 6, panels: 1 } });
  const motor = item("motor");

  it("persianas e vidraçaria mostram largura x altura", () => {
    for (const niche of ["cortinas", "vidracaria_esquadrias"] as const) {
      const label = formatProjectItemMeasure(rolo, NICHE_CONFIGS[niche].pricing);
      expect(label).toMatch(/1,8.*x.*2,4/);
    }
  });

  it("persianas mostram a altura máxima da faixa", () => {
    expect(formatProjectItemMeasure(wave, NICHE_CONFIGS.cortinas.pricing)).toMatch(/até/);
  });

  it("climatização chama a medida linear de comprimento", () => {
    expect(formatProjectItemMeasure(tubo, NICHE_CONFIGS.climatizacao.pricing)).toMatch(/^Comprimento 6/);
  });

  it("automação e segurança não cobram por medida e não mostram medida", () => {
    for (const niche of ["automacao_residencial", "seguranca_eletronica"] as const) {
      expect(formatProjectItemMeasure(rolo, NICHE_CONFIGS[niche].pricing)).toBeNull();
    }
  });

  it("item sem medida não mostra nada em nicho nenhum", () => {
    for (const niche of TENANT_NICHES) {
      expect(formatProjectItemMeasure(motor, NICHE_CONFIGS[niche].pricing), niche).toBeNull();
    }
  });

  it("quantidade no formato brasileiro", () => {
    expect(formatProjectItemQuantity(2)).toBe("Qtd. 2");
    expect(formatProjectItemQuantity(1.5)).toBe("Qtd. 1,5");
  });
});

describe("camada de resposta imediata", () => {
  const items = [item("a"), item("b")];

  it("mostra a situação marcada antes de o servidor confirmar", () => {
    const shown = applyItemOverlay(items, { a: "installed" });
    expect(shown.map((i) => i.status)).toEqual(["installed", "pending"]);
    expect(applyItemOverlay(items, {})).toBe(items);
  });

  it("sai da camada quando o listener mostra o mesmo valor, ou o item some", () => {
    const confirmed = [item("a", { status: "installed" }), item("b")];
    expect(pruneItemOverlay(confirmed, { a: "installed", b: "in_stock" })).toEqual({ b: "in_stock" });
    expect(pruneItemOverlay([item("b")], { a: "installed" })).toEqual({});
    const untouched = { b: "in_stock" as const };
    expect(pruneItemOverlay(items, untouched)).toBe(untouched);
  });

  it("servidor recusou: tira só os itens daquela chamada", () => {
    expect(dropFromItemOverlay({ a: "installed", b: "in_stock" }, ["a"])).toEqual({ b: "in_stock" });
  });
});
