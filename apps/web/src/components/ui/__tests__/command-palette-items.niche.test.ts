import { describe, expect, it } from "vitest";

import {
  searchItems,
  searchItemsForNiche,
} from "@/components/ui/command-palette-items";
import { getNicheConfig } from "@/lib/niches/config";
import { TENANT_NICHES } from "@/lib/niches/niche-ids";

/**
 * A paleta tem que dizer o mesmo nome que o menu. Em segurança o menu dizia
 * "Sistemas" e a paleta, "Soluções".
 */

const byId = (niche: Parameters<typeof getNicheConfig>[0], id: string) =>
  searchItemsForNiche(getNicheConfig(niche)).find((item) => item.id === id);

describe("searchItemsForNiche", () => {
  it("automação mantém Soluções e Ambientes como hoje", () => {
    const solutions = byId("automacao_residencial", "solutions");
    expect(solutions?.label).toBe("Soluções");
    expect(solutions?.description).toBe("Gerenciar soluções e templates");
    expect(byId("automacao_residencial", "ambientes")?.label).toBe("Ambientes");
  });

  it("segurança eletrônica chama Soluções de Sistemas, e acha por 'sistema'", () => {
    const solutions = byId("seguranca_eletronica", "solutions");
    expect(solutions?.label).toBe("Sistemas");
    expect(solutions?.description).toBe("Gerenciar sistemas e templates");
    expect(solutions?.keywords).toEqual(expect.arrayContaining(["sistema", "sistemas"]));
    expect(byId("seguranca_eletronica", "ambientes")?.label).toBe("Áreas");
  });

  it("persianas e toldos mostram Ambientes", () => {
    const ambientes = byId("cortinas", "ambientes");
    expect(ambientes?.label).toBe("Ambientes");
    expect(ambientes?.description).toBe("Gerenciar ambientes e produtos padrões");
  });

  it("o rótulo é o mesmo do menu em todo nicho", () => {
    for (const niche of TENANT_NICHES) {
      expect(byId(niche, "solutions")?.label).toBe(
        getNicheConfig(niche).solutionsPage.navigationLabel,
      );
    }
  });

  it("ids, caminhos e os demais destinos não mudam", () => {
    for (const niche of TENANT_NICHES) {
      const items = searchItemsForNiche(getNicheConfig(niche));
      expect(items.map((item) => [item.id, item.path])).toEqual(
        searchItems.map((item) => [item.id, item.path]),
      );
      const products = items.find((item) => item.id === "products");
      expect(products).toBe(searchItems.find((item) => item.id === "products"));
    }
  });
});
