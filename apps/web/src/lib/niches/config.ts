import type { TenantNiche } from "@/types";
import { DEFAULT_NICHE, isTenantNiche } from "./registry";
import type { InventoryDefinition, NicheConfig, SolutionsPageDefinition } from "./config-types";
import { nicheConfig as automacaoResidencial } from "./definitions/automacao_residencial/app";
import { nicheConfig as cortinas } from "./definitions/cortinas/app";
import { nicheConfig as segurancaEletronica } from "./definitions/seguranca_eletronica/app";
import { nicheConfig as vidracariaEsquadrias } from "./definitions/vidracaria_esquadrias/app";
import { nicheConfig as moveisPlanejados } from "./definitions/moveis_planejados/app";

export * from "./config-types";

/**
 * A configuração de tela de cada nicho, uma pasta por nicho em
 * `lib/niches/definitions/<id>/`. O `Record` faz o compilador cobrar a pasta de
 * um nicho novo.
 */
export const NICHE_CONFIGS: Record<TenantNiche, NicheConfig> = {
  automacao_residencial: automacaoResidencial,
  cortinas: cortinas,
  seguranca_eletronica: segurancaEletronica,
  vidracaria_esquadrias: vidracariaEsquadrias,
  moveis_planejados: moveisPlanejados,
};

/** Nicho desconhecido (ou vindo de um doc antigo) é tratado como automação. */
export function getNicheConfig(niche?: TenantNiche | null): NicheConfig {
  return NICHE_CONFIGS[isTenantNiche(niche) ? niche : DEFAULT_NICHE];
}

export function isPageEnabledForNiche(
  niche: TenantNiche | null | undefined,
  pageId?: string | null,
): boolean {
  if (!pageId) return true;

  const availability: Partial<Record<string, boolean>> =
    getNicheConfig(niche).pageAvailability;
  return availability[pageId] !== false;
}

export function getSolutionsPageConfig(
  niche?: TenantNiche | null,
): SolutionsPageDefinition {
  return getNicheConfig(niche).solutionsPage;
}

export function parseInventoryValue(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : 0;
  }

  return 0;
}

export function resolveInventoryValue(record: {
  inventoryValue?: unknown;
  stock?: unknown;
}): number {
  if (record.inventoryValue !== undefined && record.inventoryValue !== null) {
    return parseInventoryValue(record.inventoryValue);
  }

  return parseInventoryValue(record.stock);
}

export function formatInventoryValue(
  value: number,
  inventory: InventoryDefinition,
): string {
  const maximumFractionDigits = inventory.step < 1 ? 2 : 0;
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  });

  return `${formatted} ${inventory.unitSuffix}`.trim();
}
