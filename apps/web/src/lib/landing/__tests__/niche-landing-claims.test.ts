import { describe, expect, it } from "vitest";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";

/**
 * A landing de decoração prometia o que o produto não faz: medida "em qualquer
 * unidade" (só metro), "cálculo de rolos" (não existe) e "lojas que já usam a
 * ProOps" (o único cliente do nicho tinha saído). Texto de venda que o produto
 * não sustenta vira reclamação no primeiro uso.
 */
const FORBIDDEN = [
  /qualquer unidade/i,
  /rolos?\b/i,
  /pap[eé]is de parede/i,
  /j[aá] usam a ProOps/i,
];

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return "";
}

describe("landing de persianas e toldos", () => {
  const copy = textOf(NICHE_LANDING_CONFIG.cortinas);

  it.each(FORBIDDEN)("não promete %s", (pattern) => {
    expect(copy).not.toMatch(pattern);
  });

  it("fala dos três modos de preço que o produto tem", () => {
    const titles = NICHE_LANDING_CONFIG.cortinas.modules.map((module) => module.title);
    expect(titles).toEqual(["Por área (m²)", "Por faixa de altura", "Por metro de largura"]);
  });
});
