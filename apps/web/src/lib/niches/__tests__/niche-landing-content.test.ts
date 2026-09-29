import { describe, expect, it } from "vitest";

import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import { NICHE_CONFIGS } from "@/lib/niches/config";
import { NICHE_REGISTRY, TENANT_NICHES } from "@/lib/niches/registry";
import { getContrastRatio } from "@/utils/color-utils";

/**
 * O conteúdo de cada landing de nicho contra o que o nicho É no produto.
 * A landing é dado (`definitions/<id>/landing.ts`), e dado escrito à mão sai
 * do lugar em silêncio: um modo de preço vendido que o nicho não tem, uma cor
 * ilegível no tema escuro, uma cena que não atravessa a fronteira do servidor.
 */

function hex(cor: string): [number, number, number] {
  const m = cor.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)) as [number, number, number];
}

function distancia(a: string, b: string): number {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

describe.each([...TENANT_NICHES])("landing de %s", (niche) => {
  const config = NICHE_LANDING_CONFIG[niche];
  const nicho = NICHE_CONFIGS[niche];

  it("o título leva o nome do nicho do registro", () => {
    expect(config.hero.titleHighlight).toBe(NICHE_REGISTRY[niche].label);
  });

  it("o acento é legível nos dois temas (4,5:1, texto pequeno)", () => {
    expect(getContrastRatio(config.acento.claro, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(config.acento.escuro, "#0a0a0a")).toBeGreaterThanOrEqual(4.5);
  });

  it("vende exatamente os modos de preço por medida que o nicho tem", () => {
    const modos = config.modules.map((m) => m.modo).filter((m) => m && m !== "standard");
    expect(new Set(modos)).toEqual(new Set(nicho.pricing.dimensionModes));
  });

  it("os produtos da cena só usam modos de preço que o nicho tem", () => {
    const permitidos = new Set(["standard", ...nicho.pricing.dimensionModes]);
    const modos = [...JSON.stringify(config.cena.dados).matchAll(/"mode":"([a-z_]+)"/g)].map((m) => m[1]);
    expect(modos.length).toBeGreaterThan(0);
    for (const modo of modos) expect(permitidos.has(modo), modo).toBe(true);
  });

  it("a cena atravessa a fronteira do servidor (é serializável)", () => {
    expect(JSON.parse(JSON.stringify(config.cena.dados))).toEqual(config.cena.dados);
  });

  it("três dores e três provas", () => {
    expect(config.dores).toHaveLength(3);
    expect(config.hero.provas).toHaveLength(3);
  });
});

describe("acentos entre nichos", () => {
  it("cada nicho tem uma cor que se distingue das outras", () => {
    for (const [i, a] of TENANT_NICHES.entries()) {
      for (const b of TENANT_NICHES.slice(i + 1)) {
        expect(distancia(NICHE_LANDING_CONFIG[a].acento.claro, NICHE_LANDING_CONFIG[b].acento.claro)).toBeGreaterThan(60);
      }
    }
  });

  it("toda cena escolhida existe e nenhuma se repete", () => {
    const tipos = TENANT_NICHES.map((n) => NICHE_LANDING_CONFIG[n].cena.dados.tipo);
    expect(new Set(tipos).size).toBe(tipos.length);
  });
});
