import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIMENSION_MODE_LABELS,
  DEFAULT_MEASURE_TERMS,
  dimensionModeLabel,
  measureTerms,
} from "@/lib/pricing/dimension-mode-labels";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import { TENANT_NICHES } from "@/lib/niches/registry";
import { term } from "@/lib/niches/vocabulary";

/**
 * O nome de cada modo de preço por medida sai daqui, e não do id histórico
 * `curtain_*`. Um nicho troca só o que precisar (marcenaria diria "Por m² de
 * chapa"), e o resto fica no padrão.
 */
describe("rótulos dos modos por medida", () => {
  it("sem override, usa o padrão", () => {
    expect(dimensionModeLabel({}, "curtain_meter")).toEqual(DEFAULT_DIMENSION_MODE_LABELS.curtain_meter);
    expect(dimensionModeLabel(NICHE_CONFIGS.cortinas.pricing, "curtain_height").short).toBe("Por altura");
  });

  it("o nicho troca só os campos que declara", () => {
    const label = dimensionModeLabel(
      { modeLabels: { curtain_meter: { short: "Por m² de chapa" } } },
      "curtain_meter",
    );
    expect(label.short).toBe("Por m² de chapa");
    expect(label.ruleTitle).toBe(DEFAULT_DIMENSION_MODE_LABELS.curtain_meter.ruleTitle);
  });
});

/**
 * O nome das medidas nos campos. "Largura" era escrito à mão nas três telas
 * de preço por medida, e a tubulação de climatização se mede em comprimento.
 */
describe("nomes das medidas", () => {
  it("sem override, largura e altura", () => {
    expect(measureTerms({}, "curtain_width")).toEqual(DEFAULT_MEASURE_TERMS);
    expect(measureTerms({}, "curtain_meter").height.singular).toBe("altura");
  });

  it("o nicho troca a medida de um modo sem mexer nos outros", () => {
    const pricing = { measureLabels: { curtain_width: { width: term("comprimento", "comprimentos", "m") } } };
    expect(measureTerms(pricing, "curtain_width").width).toEqual(term("comprimento", "comprimentos", "m"));
    expect(measureTerms(pricing, "curtain_width").height).toEqual(DEFAULT_MEASURE_TERMS.height);
    expect(measureTerms(pricing, "curtain_meter").width.singular).toBe("largura");
  });

  it.each([...TENANT_NICHES])("o nicho %s tem nome para cada medida dos modos que usa", (niche) => {
    const { pricing } = NICHE_CONFIGS[niche];
    for (const mode of pricing.dimensionModes) {
      const { width, height } = measureTerms(pricing, mode);
      expect(width.singular.trim(), `${niche} ${mode}`).not.toBe("");
      expect(height.singular.trim(), `${niche} ${mode}`).not.toBe("");
      expect(width.singular, "sempre minúsculo; a tela capitaliza").toBe(width.singular.toLowerCase());
    }
  });
});
