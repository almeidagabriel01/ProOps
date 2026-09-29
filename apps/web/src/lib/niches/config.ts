import type { TenantNiche } from "@/types";
import { DEFAULT_NICHE, isTenantNiche } from "./registry";
import type { InventoryDefinition, InventoryUnit, NicheConfig, SolutionsPageDefinition } from "./config-types";
import { normalizeProductPricingModel, type ProductPricingMode, type ProductPricingModel } from "@/lib/product-pricing";
import { meterInventoryDefinition, unitInventoryDefinition } from "./inventory-definitions";
import { nicheConfig as automacaoResidencial } from "./definitions/automacao_residencial/app";
import { nicheConfig as cortinas } from "./definitions/cortinas/app";
import { nicheConfig as segurancaEletronica } from "./definitions/seguranca_eletronica/app";
import { nicheConfig as vidracariaEsquadrias } from "./definitions/vidracaria_esquadrias/app";
import { nicheConfig as marcenaria } from "./definitions/marcenaria/app";

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
  marcenaria: marcenaria,
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

/**
 * A unidade de estoque de um produto: por unidade quando ele é cobrado por
 * quantidade, por metro quando é cobrado por medida. Em qualquer nicho: a
 * tubulação de climatização conta metros num catálogo que conta aparelhos em
 * unidade, e o motor de uma persiana conta unidades num catálogo de metros.
 */
export function catalogInventoryUnit(pricingMode: ProductPricingMode): InventoryUnit {
  return pricingMode === "standard" ? "unit" : "meter";
}

/**
 * A definição de estoque que a tela usa para um produto: a do nicho quando a
 * unidade bate (com os textos do nicho, como o m² de vidraçaria), e a genérica
 * da unidade do produto quando não bate.
 */
export function inventoryDefinitionFor(
  nicheInventory: InventoryDefinition,
  productUnit: InventoryUnit | undefined,
): InventoryDefinition {
  if (!productUnit || productUnit === nicheInventory.mode) return nicheInventory;
  return productUnit === "meter" ? meterInventoryDefinition : unitInventoryDefinition;
}

/**
 * A unidade de estoque de um produto já cadastrado: a que ele gravou, ou, em
 * produto antigo sem esse campo, a que o modo de preço dele pede.
 */
export function productInventoryUnit(product: {
  inventoryUnit?: InventoryUnit;
  pricingModel?: ProductPricingModel;
}): InventoryUnit {
  return product.inventoryUnit ?? catalogInventoryUnit(normalizeProductPricingModel(product.pricingModel).mode);
}
