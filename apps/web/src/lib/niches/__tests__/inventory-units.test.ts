import { describe, expect, it } from "vitest";
import {
  NICHE_CONFIGS,
  catalogInventoryUnit,
  inventoryDefinitionFor,
  productInventoryUnit,
} from "@/lib/niches/config";

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

/**
 * A unidade é do PRODUTO, não do nicho: a tubulação de climatização conta
 * metros num catálogo de aparelhos, e o motor de uma persiana conta unidades
 * num catálogo de metros. Antes a lista de produtos mostrava e GRAVAVA a
 * unidade do nicho, então editar o estoque de um motor o marcava como metro.
 */
describe("unidade de estoque por produto", () => {
  it("cobrado por quantidade conta em unidade; por medida, em metro", () => {
    expect(catalogInventoryUnit("standard")).toBe("unit");
    expect(catalogInventoryUnit("curtain_width")).toBe("meter");
    expect(catalogInventoryUnit("curtain_meter")).toBe("meter");
  });

  it("a unidade gravada no produto vale", () => {
    expect(productInventoryUnit({ inventoryUnit: "unit", pricingModel: { mode: "curtain_width" } })).toBe("unit");
  });

  it("produto antigo sem a unidade segue o modo de preço", () => {
    expect(productInventoryUnit({ pricingModel: { mode: "standard" } })).toBe("unit");
    expect(productInventoryUnit({ pricingModel: { mode: "curtain_meter" } })).toBe("meter");
    expect(productInventoryUnit({})).toBe("unit");
  });

  it("a tela usa os textos do nicho quando a unidade bate, e a genérica quando não bate", () => {
    const seguranca = NICHE_CONFIGS.seguranca_eletronica.productCatalog.inventory;
    expect(inventoryDefinitionFor(seguranca, "unit")).toBe(seguranca);
    expect(inventoryDefinitionFor(seguranca, "meter").unitSuffix).toBe("m");

    const persianas = NICHE_CONFIGS.cortinas.productCatalog.inventory;
    expect(inventoryDefinitionFor(persianas, "unit").unitSuffix).toBe("un");

    const vidracaria = NICHE_CONFIGS.vidracaria_esquadrias.productCatalog.inventory;
    expect(inventoryDefinitionFor(vidracaria, "meter").unitSuffix).toBe("m²");
  });
});
