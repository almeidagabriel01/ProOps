import { describe, expect, it } from "vitest";
import { resolveCatalogImageLimit as backend } from "../../../functions/src/shared/catalog-image-limits";
import { resolveCatalogImageLimit as front } from "@/lib/catalog-image-limits";

/**
 * A tela e o backend têm que aceitar o MESMO número de imagens: quando os dois
 * divergiram, a tela aceitava a 3ª foto e o backend recusava ao salvar.
 */
describe("limite de imagens por item: front e backend iguais", () => {
  const nichos = ["cortinas", "automacao_residencial", "", null, undefined, "outro"];
  const tipos = ["product", "service"] as const;
  for (const niche of nichos) {
    for (const itemType of tipos) {
      it(`${String(niche)} / ${itemType}`, () => {
        expect(front({ niche, itemType })).toBe(backend({ niche, itemType }));
      });
    }
  }

  it("valores esperados", () => {
    expect(front({ niche: "cortinas", itemType: "product" })).toBe(3);
    expect(front({ niche: "automacao_residencial", itemType: "product" })).toBe(1);
    expect(front({ niche: "cortinas", itemType: "service" })).toBe(1);
  });
});
