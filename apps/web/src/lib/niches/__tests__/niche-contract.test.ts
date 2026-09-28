import { describe, expect, it } from "vitest";
import { DEFAULT_STAGE_TEMPLATES } from "../../../../../functions/src/api/services/projects/project-model";
import { DEFAULT_VISIT_TYPE_BY_NICHE } from "../../../../../functions/src/api/services/booking/booking-model";
import { PRODUCT_IMAGE_LIMIT_BY_NICHE } from "@/lib/catalog-image-limits";
import { NICHE_LANDING_CONFIG } from "@/lib/landing/niches.config";
import { NICHE_CONFIGS, NICHE_PAGE_KEYS, getNicheConfig } from "@/lib/niches/config";
import { TENANT_NICHES } from "@/lib/niches/niche-ids";
import { NICHE_REGISTRY } from "@/lib/niches/registry";
import { NICHE_LABELS } from "@/types";
import { DEMO_DATASETS } from "../../../../../functions/src/scripts/demo/datasets";
import { NICHOS_PRONTOS, SEGMENTOS } from "@/app/(empresa)/institucional/_content/institucional-copy";

/**
 * O contrato de um nicho: tudo que precisa existir para ele funcionar de ponta
 * a ponta. Um nicho que esqueça uma peça cai no padrão de automação sem erro
 * nenhum (etapas de obra, tipo de visita, rótulo), e só o cliente percebe.
 * O compilador pega boa parte disso; este teste pega o resto e documenta a
 * lista num lugar só.
 */
describe.each([...TENANT_NICHES])("contrato do nicho %s", (niche) => {
  it("tem configuração própria, com o mesmo id", () => {
    expect(NICHE_CONFIGS[niche]?.id).toBe(niche);
    expect(getNicheConfig(niche)).toBe(NICHE_CONFIGS[niche]);
  });

  it("declara todas as páginas que ligam e desligam", () => {
    expect(Object.keys(NICHE_CONFIGS[niche].pageAvailability).sort()).toEqual(
      [...NICHE_PAGE_KEYS].sort(),
    );
  });

  it("mostra Soluções ou Ambientes, nunca os dois nem nenhum", () => {
    const { solutions, ambientes } = NICHE_CONFIGS[niche].pageAvailability;
    expect(solutions !== ambientes).toBe(true);
  });

  it("tem rótulo", () => {
    expect(NICHE_LABELS[niche]).toBeTruthy();
    expect(NICHE_CONFIGS[niche].label).toBeTruthy();
  });

  it("tem landing", () => {
    expect(NICHE_LANDING_CONFIG[niche]?.slug).toBe(niche);
  });

  it("tem etapas de obra e tipo de visita próprios no backend", () => {
    expect(DEFAULT_STAGE_TEMPLATES[niche]?.length).toBeGreaterThan(0);
    expect(DEFAULT_VISIT_TYPE_BY_NICHE[niche]?.label).toBeTruthy();
  });

  it("declara quantas imagens um produto aceita", () => {
    expect(PRODUCT_IMAGE_LIMIT_BY_NICHE[niche]).toBeGreaterThan(0);
  });

  it("modo de produto padrão coerente com os modos por medida do nicho", () => {
    const { dimensionModes, defaultProductMode } = NICHE_CONFIGS[niche].pricing;
    if (defaultProductMode !== "standard") {
      expect(dimensionModes).toContain(defaultProductMode);
    }
  });
});

describe("site da empresa lista os nichos prontos", () => {
  // O site só pode prometer o que o produto tem: um nicho ligado aqui entra lá,
  // e um nicho que saiu daqui sai de lá.
  it("NICHOS_PRONTOS tem um item por nicho", () => {
    expect(NICHOS_PRONTOS).toHaveLength(TENANT_NICHES.length);
  });

  // A prancheta do herói é a primeira coisa que o visitante vê: um nicho pronto
  // sem desenho lá é um cliente que não se reconhece e fecha a aba. Segurança
  // eletrônica nasceu assim.
  it.each([...TENANT_NICHES])("a prancheta do herói desenha o nicho %s como pronto", (niche) => {
    expect(SEGMENTOS.filter((segmento) => segmento.nicho === niche)).toHaveLength(1);
  });
});

describe.each([...TENANT_NICHES])("demonstração do nicho %s", (niche) => {
  const dataset = DEMO_DATASETS[niche];

  it("usa o tenant de demonstração do registro", () => {
    expect(dataset.niche).toBe(niche);
    expect(dataset.tenantId).toBe(NICHE_REGISTRY[niche].demoTenantId);
  });

  it("o exemplo do card de atenção aponta para propostas da demonstração do nicho", () => {
    const proposals = new Map(dataset.proposals.items.map((p) => [p.id, p.title]));
    for (const item of NICHE_CONFIGS[niche].demoAttention.items) {
      expect(proposals.get(item.id), `${item.id} não está no dataset de ${niche}`).toBe(item.title);
      expect(item.href).toBe(`/proposals/${item.id}/view`);
    }
  });
});
