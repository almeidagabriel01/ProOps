import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIMENSION_MODE_LABELS,
  dimensionModeLabel,
} from "@/lib/pricing/dimension-mode-labels";
import { NICHE_CONFIGS } from "@/lib/niches/config";

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
