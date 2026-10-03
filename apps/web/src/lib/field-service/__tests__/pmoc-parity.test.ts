import { describe, expect, it } from "vitest";
import * as front from "../pmoc";
import * as backend from "../../../../../functions/src/shared/pmoc";

/**
 * O formulário monta o plano do PMOC com a cópia do front; a rotina abre as
 * visitas com a do backend. Se as duas andarem separadas, o plano salvo traz
 * itens que o backend não conhece pelo id, e o relatório deixa de juntar as
 * visitas.
 */
describe("PMOC: front e backend iguais", () => {
  it("modelos, frequências e rótulos", () => {
    expect(front.PMOC_TEMPLATES).toEqual(backend.PMOC_TEMPLATES);
    expect(front.PMOC_CATEGORIES).toEqual(backend.PMOC_CATEGORIES);
    expect(front.PMOC_CATEGORY_LABELS).toEqual(backend.PMOC_CATEGORY_LABELS);
    expect(front.PMOC_FREQUENCIES).toEqual(backend.PMOC_FREQUENCIES);
    expect(front.PMOC_FREQUENCY_LABELS).toEqual(backend.PMOC_FREQUENCY_LABELS);
    expect(front.PMOC_FREQUENCY_MONTHS).toEqual(backend.PMOC_FREQUENCY_MONTHS);
  });

  it.each([
    [[]],
    [["Split hi-wall", "Cassete"]],
    [["VRF", "Janela", "Cortina de ar"]],
    [["Sistema VRV", null]],
  ])("o mesmo plano para %j", (types) => {
    expect(front.buildPmocItems(types)).toEqual(backend.buildPmocItems(types));
  });
});
