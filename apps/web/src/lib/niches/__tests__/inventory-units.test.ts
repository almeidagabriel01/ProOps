import { describe, expect, it } from "vitest";
import { NICHE_CONFIGS } from "@/lib/niches/config";

/**
 * O estoque por medida diz a unidade que o nicho conta: vidro e chapa em m²,
 * tecido de persiana em metro linear. Antes vidraçaria e marcenaria herdavam
 * "metros" de persianas.
 */
describe("unidade do estoque por medida", () => {
  it.each(["vidracaria_esquadrias", "marcenaria"] as const)("%s conta em m²", (niche) => {
    const { inventory } = NICHE_CONFIGS[niche].productCatalog;
    expect(inventory.mode).toBe("meter");
    expect(inventory.unitSuffix).toBe("m²");
    expect(inventory.priceSuffix).toBe("/ m²");
  });

  it("persianas continua em metro linear", () => {
    expect(NICHE_CONFIGS.cortinas.productCatalog.inventory.unitSuffix).toBe("m");
  });
});
