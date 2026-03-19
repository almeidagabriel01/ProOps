import type { TenantNiche } from "@/types";

export type InventoryUnit = "unit" | "meter";
export type ProposalWorkflow = "automation" | "catalog" | "environment";
export type SolutionsPageMode = "automation" | "environment";

export interface InventoryDefinition {
  mode: InventoryUnit;
  unitLabel: string;
  unitSuffix: string;
  priceSuffix: string;
  tableHeader: string;
  formLabel: string;
  formInitialLabel: string;
  readOnlyLabel: string;
  pageDescription: string;
  emptyStateDescription: string;
  costBalanceLabel: string;
  revenueBalanceLabel: string;
  lowValueThreshold: number;
  step: number;
}

export interface ProductCatalogDefinition {
  singularLabel: string;
  pluralLabel: string;
  newTitle: string;
  newSubtitle: string;
  editTitle: string;
  editSubtitle: (productName: string) => string;
  viewTitle: string;
  viewSubtitle: (productName: string) => string;
  inventory: InventoryDefinition;
}

export interface SolutionsPageDefinition {
  navigationLabel: string;
  pageTitle: string;
  pageDescription: string;
  mode: SolutionsPageMode;
}

export interface NicheConfig {
  id: TenantNiche;
  label: string;
  pageAvailability: Partial<Record<string, boolean>>;
  solutionsPage: SolutionsPageDefinition;
  proposal: {
    workflow: ProposalWorkflow;
  };
  productCatalog: ProductCatalogDefinition;
}

const unitInventoryDefinition: InventoryDefinition = {
  mode: "unit",
  unitLabel: "unidades",
  unitSuffix: "un",
  priceSuffix: "",
  tableHeader: "Estoque",
  formLabel: "Estoque",
  formInitialLabel: "Estoque Inicial",
  readOnlyLabel: "Estoque",
  pageDescription: "Gerencie o catálogo de produtos, estoque e preços.",
  emptyStateDescription:
    "Cadastre seus produtos para gerenciar estoque e criar propostas.",
  costBalanceLabel: "Saldo de custo em estoque",
  revenueBalanceLabel: "Saldo com markup em estoque",
  lowValueThreshold: 10,
  step: 1,
};

const meterInventoryDefinition: InventoryDefinition = {
  mode: "meter",
  unitLabel: "metros",
  unitSuffix: "m",
  priceSuffix: "/ m",
  tableHeader: "Metragem",
  formLabel: "Metragem",
  formInitialLabel: "Metragem Inicial",
  readOnlyLabel: "Metragem",
  pageDescription:
    "Gerencie o catálogo de cortinas, a metragem disponível e os preços.",
  emptyStateDescription:
    "Cadastre seus tecidos, modelos ou kits para controlar a metragem disponível e montar propostas.",
  costBalanceLabel: "Saldo de custo em metragem",
  revenueBalanceLabel: "Saldo com markup em metragem",
  lowValueThreshold: 10,
  step: 0.01,
};

export const NICHE_CONFIGS: Record<TenantNiche, NicheConfig> = {
  automacao_residencial: {
    id: "automacao_residencial",
    label: "Automação Residencial",
    pageAvailability: {
      solutions: true,
    },
    solutionsPage: {
      navigationLabel: "Soluções",
      pageTitle: "Soluções",
      pageDescription: "Central de gerenciamento de soluções e ambientes.",
      mode: "automation",
    },
    proposal: {
      workflow: "automation",
    },
    productCatalog: {
      singularLabel: "Produto",
      pluralLabel: "Produtos",
      newTitle: "Novo Produto",
      newSubtitle:
        "Adicione um novo produto ao seu catálogo com todas as informações necessárias.",
      editTitle: "Editar Produto",
      editSubtitle: (productName) =>
        `Atualize as informações de "${productName}"`,
      viewTitle: "Visualizar Produto",
      viewSubtitle: (productName) => `Detalhes do produto "${productName}"`,
      inventory: unitInventoryDefinition,
    },
  },
  cortinas: {
    id: "cortinas",
    label: "Cortinas",
    pageAvailability: {
      solutions: true,
    },
    solutionsPage: {
      navigationLabel: "Ambientes",
      pageTitle: "Ambientes",
      pageDescription:
        "Gerencie os ambientes e configure os produtos padrões de cada espaço.",
      mode: "environment",
    },
    proposal: {
      workflow: "environment",
    },
    productCatalog: {
      singularLabel: "Produto",
      pluralLabel: "Produtos",
      newTitle: "Novo Produto",
      newSubtitle:
        "Adicione um novo item ao catálogo de cortinas com preço, acabamento e metragem.",
      editTitle: "Editar Produto",
      editSubtitle: (productName) =>
        `Atualize as informações de "${productName}"`,
      viewTitle: "Visualizar Produto",
      viewSubtitle: (productName) => `Detalhes do produto "${productName}"`,
      inventory: meterInventoryDefinition,
    },
  },
};

const DEFAULT_NICHE: TenantNiche = "automacao_residencial";

export function getNicheConfig(niche?: TenantNiche | null): NicheConfig {
  if (!niche) {
    return NICHE_CONFIGS[DEFAULT_NICHE];
  }

  return NICHE_CONFIGS[niche] || NICHE_CONFIGS[DEFAULT_NICHE];
}

export function isPageEnabledForNiche(
  niche: TenantNiche | null | undefined,
  pageId?: string | null,
): boolean {
  if (!pageId) return true;

  const config = getNicheConfig(niche);
  const pageState = config.pageAvailability[pageId];
  return pageState !== false;
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
