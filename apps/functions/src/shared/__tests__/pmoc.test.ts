/**
 * Modelos do PMOC: quais itens entram no plano de cada contrato e quais entram
 * em cada visita, pela frequência. A regra é nunca deixar um item passar do
 * prazo, mesmo quando o intervalo das visitas não divide a frequência.
 */

import {
  PMOC_CATEGORIES,
  PMOC_TEMPLATES,
  buildPmocItems,
  isPmocItemDue,
  monthsBetween,
  pmocCategoryForType,
  pmocItemsForVisit,
  pmocOrderChecklist,
  type PmocFrequency,
} from "../pmoc";
import { MAX_ORDER_CHECKLIST } from "../../api/services/field-service/field-service-model";

describe("modelos", () => {
  it("ids únicos em todos os modelos", () => {
    const ids = PMOC_CATEGORIES.flatMap((c) => PMOC_TEMPLATES[c].map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("o plano mais completo cabe numa OS", () => {
    const all = buildPmocItems(["Split hi-wall", "VRF", "Janela"]);
    expect(all.length).toBeLessThanOrEqual(MAX_ORDER_CHECKLIST);
    for (const item of pmocOrderChecklist(all)) {
      expect(item.id.length).toBeLessThanOrEqual(64);
      expect(item.text.length).toBeLessThanOrEqual(200);
    }
  });

  it("nenhum modelo vazio, e nenhum texto com travessão", () => {
    for (const category of PMOC_CATEGORIES) {
      expect(PMOC_TEMPLATES[category].length).toBeGreaterThan(0);
      for (const item of PMOC_TEMPLATES[category]) expect(item.text).not.toMatch(/—/);
    }
  });
});

describe("tipo do aparelho", () => {
  it.each([
    ["Split hi-wall", "split"],
    ["Cassete", "split"],
    ["Piso-teto", "split"],
    ["Multi-split", "split"],
    ["VRF", "vrf"],
    ["Sistema VRV", "vrf"],
    ["Janela", "window"],
    ["Ar de janela", "window"],
    ["Cortina de ar", null],
    ["", "split"],
    [null, "split"],
  ])("%s → %s", (type, expected) => {
    expect(pmocCategoryForType(type)).toBe(expected);
  });

  it("o ambiente entra sempre; sem aparelho conhecido, o split", () => {
    const categories = (types: Array<string | null>) => [...new Set(buildPmocItems(types).map((i) => i.category))];
    expect(categories([])).toEqual(["split", "environment"]);
    expect(categories(["Cortina de ar"])).toEqual(["split", "environment"]);
    expect(categories(["VRF", "Janela", "VRF"])).toEqual(["vrf", "window", "environment"]);
  });
});

describe("frequência por visita", () => {
  const dueMonths = (frequency: PmocFrequency, interval: number) =>
    Array.from({ length: Math.floor(24 / interval) + 1 }, (_, i) => i * interval).filter((offset) =>
      isPmocItemDue(frequency, offset, interval),
    );

  it("visitas mensais: cada item no próprio ritmo", () => {
    expect(dueMonths("monthly", 1)).toHaveLength(25);
    expect(dueMonths("quarterly", 1)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24]);
    expect(dueMonths("semiannual", 1)).toEqual([0, 6, 12, 18, 24]);
    expect(dueMonths("annual", 1)).toEqual([0, 12, 24]);
  });

  it("item mais frequente que as visitas entra em todas", () => {
    expect(dueMonths("monthly", 3)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24]);
    expect(dueMonths("quarterly", 6)).toEqual([0, 6, 12, 18, 24]);
  });

  it("intervalo que não divide a frequência nunca atrasa o item", () => {
    expect(dueMonths("quarterly", 2)).toEqual([0, 4, 6, 10, 12, 16, 18, 22, 24]);
    const months = dueMonths("quarterly", 2);
    for (let i = 1; i < months.length; i++) expect(months[i] - months[i - 1]).toBeLessThanOrEqual(3 + 2 - 1);
  });

  it("meses pelo calendário, virando o ano", () => {
    expect(monthsBetween("2026-10-09", "2027-01-09")).toBe(3);
    expect(monthsBetween("2026-10-09", "2026-10-30")).toBe(0);
  });

  it("sem âncora, a visita é a primeira e leva tudo", () => {
    const items = buildPmocItems(["Split"]);
    expect(pmocItemsForVisit({ items, anchorDate: null, visitDate: "2027-01-09", intervalMonths: 3 })).toHaveLength(
      items.length,
    );
    const third = pmocItemsForVisit({ items, anchorDate: "2026-10-09", visitDate: "2027-01-09", intervalMonths: 3 });
    expect(new Set(third.map((i) => i.frequency))).toEqual(new Set(["monthly", "quarterly"]));
  });
});
