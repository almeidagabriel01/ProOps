/**
 * Catalogo canonico dos planos: o que cada tier libera e ate onde.
 *
 * ESTE ARQUIVO E A FONTE UNICA DA VERDADE. Antes dele havia cinco tabelas
 * independentes descrevendo os mesmos planos (`PLAN_LIMITS_BY_TIER`,
 * `LEGACY_*_LIMITS`, `planMetadata` do stripe.controller, `TIER_DEFAULT_FEATURES`
 * do admin.controller e `DEFAULT_PLANS` no front) — e elas ja discordavam entre
 * si: `free.maxProposals` valia 5 numa e 15 noutra. Todas derivam daqui agora.
 *
 * Duas metades, com naturezas diferentes:
 *
 * - `limits`  — quanto. Aplicados por `enforceTenantPlanLimit`, que compara uso
 *               corrente contra o teto. `-1` = ilimitado.
 * - `capabilities` — se. Aplicados por `requirePlanCapability`, que responde
 *               sim/nao antes de a rota rodar. Esta metade NAO existia: o
 *               backend so sabia contar, entao modulo novo (fiscal, calendario,
 *               Asaas) nao tinha onde declarar seu tier minimo e nenhum declarou.
 *
 * Add-ons alteram `capabilities` e `limits` por cima do tier — ver
 * `applyAddonsToCapabilities`. Um Starter que PAGOU o add-on financeiro tem
 * `financial: true` mesmo o tier dizendo o contrario.
 */

export type PlanTierId = "free" | "starter" | "pro" | "enterprise";

/**
 * Capacidades booleanas — "este plano abre este modulo?".
 *
 * `calendarSync` cobre so a integracao com o Google Agenda; a agenda interna do
 * ERP nao tem capacidade propria porque esta disponivel em todos os planos.
 */
export type PlanCapabilityKey =
  | "financial"
  | "crm"
  | "fiscal"
  | "pdfEditor"
  | "customTheme"
  | "whatsapp"
  | "calendarSync";

export type PlanCapabilities = Record<PlanCapabilityKey, boolean>;

export interface PlanNumericLimits {
  maxProposalsPerMonth: number;
  maxClients: number;
  maxProducts: number;
  maxUsers: number;
  maxWallets: number;
  maxSpreadsheets: number;
  maxPdfTemplates: number;
  maxImagesPerProduct: number;
  storageQuotaMB: number;
  aiMessagesPerMonth: number;
}

export interface PlanCatalogEntry {
  readonly tier: PlanTierId;
  readonly order: number;
  readonly capabilities: PlanCapabilities;
  readonly limits: PlanNumericLimits;
  /** Historico da Lia sobrevive a sessao. Starter conversa de forma efemera. */
  readonly aiPersistHistory: boolean;
}

export const PLAN_CAPABILITY_KEYS: readonly PlanCapabilityKey[] = [
  "financial",
  "crm",
  "fiscal",
  "pdfEditor",
  "customTheme",
  "whatsapp",
  "calendarSync",
] as const;

const NO_CAPABILITIES: PlanCapabilities = {
  financial: false,
  crm: false,
  fiscal: false,
  pdfEditor: false,
  customTheme: false,
  whatsapp: false,
  calendarSync: false,
};

export const PLAN_CATALOG: Record<PlanTierId, PlanCatalogEntry> = {
  free: {
    tier: "free",
    order: 0,
    capabilities: { ...NO_CAPABILITIES },
    limits: {
      maxProposalsPerMonth: 5,
      maxClients: 10,
      maxProducts: 20,
      maxUsers: 1,
      maxWallets: 2,
      maxSpreadsheets: 5,
      maxPdfTemplates: 1,
      maxImagesPerProduct: 2,
      storageQuotaMB: 100,
      aiMessagesPerMonth: 0,
    },
    aiPersistHistory: false,
  },
  starter: {
    tier: "starter",
    order: 1,
    // Starter nao tem modulo premium nativo — compra por add-on
    // (`financial`, `crm`, `pdf_editor_*`). O teto de 5 carteiras existe para
    // quando o add-on financeiro estiver ativo.
    capabilities: { ...NO_CAPABILITIES },
    limits: {
      maxProposalsPerMonth: 80,
      maxClients: 120,
      maxProducts: 220,
      maxUsers: 1,
      maxWallets: 5,
      maxSpreadsheets: 25,
      maxPdfTemplates: 1,
      maxImagesPerProduct: 2,
      storageQuotaMB: 200,
      aiMessagesPerMonth: 80,
    },
    aiPersistHistory: false,
  },
  pro: {
    tier: "pro",
    order: 2,
    capabilities: {
      ...NO_CAPABILITIES,
      financial: true,
      pdfEditor: true,
      customTheme: true,
      calendarSync: true,
    },
    limits: {
      maxProposalsPerMonth: -1,
      maxClients: -1,
      maxProducts: -1,
      maxUsers: 2,
      maxWallets: 30,
      maxSpreadsheets: 250,
      maxPdfTemplates: -1,
      maxImagesPerProduct: 3,
      storageQuotaMB: 2560,
      aiMessagesPerMonth: 400,
    },
    aiPersistHistory: true,
  },
  enterprise: {
    tier: "enterprise",
    order: 3,
    capabilities: {
      financial: true,
      crm: true,
      fiscal: true,
      pdfEditor: true,
      customTheme: true,
      whatsapp: true,
      calendarSync: true,
    },
    limits: {
      maxProposalsPerMonth: -1,
      maxClients: -1,
      maxProducts: -1,
      maxUsers: -1,
      maxWallets: -1,
      maxSpreadsheets: -1,
      maxPdfTemplates: -1,
      maxImagesPerProduct: 3,
      storageQuotaMB: -1,
      aiMessagesPerMonth: 1200,
    },
    aiPersistHistory: true,
  },
};

export const PLAN_TIER_ORDER: Record<PlanTierId, number> = {
  free: PLAN_CATALOG.free.order,
  starter: PLAN_CATALOG.starter.order,
  pro: PLAN_CATALOG.pro.order,
  enterprise: PLAN_CATALOG.enterprise.order,
};

export function normalizePlanTierId(value: unknown): PlanTierId | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "free" ||
    normalized === "starter" ||
    normalized === "pro" ||
    normalized === "enterprise"
  ) {
    return normalized;
  }
  return null;
}

export function getPlanCatalogEntry(tier: PlanTierId): PlanCatalogEntry {
  return PLAN_CATALOG[tier];
}

/** Copia rasa — impede que um caller mute o catalogo compartilhado. */
export function resolvePlanCapabilities(tier: PlanTierId): PlanCapabilities {
  return { ...PLAN_CATALOG[tier].capabilities };
}

export function resolvePlanLimits(tier: PlanTierId): PlanNumericLimits {
  return { ...PLAN_CATALOG[tier].limits };
}

/**
 * O menor tier que libera a capacidade — usado nas mensagens de upgrade
 * ("disponivel no plano Enterprise") em vez de texto fixo por rota.
 */
export function minimumTierForCapability(
  capability: PlanCapabilityKey,
): PlanTierId | null {
  const tiers: PlanTierId[] = ["free", "starter", "pro", "enterprise"];
  for (const tier of tiers) {
    if (PLAN_CATALOG[tier].capabilities[capability]) return tier;
  }
  return null;
}

export const PLAN_TIER_LABELS: Record<PlanTierId, string> = {
  free: "Gratuito",
  starter: "Starter",
  pro: "Profissional",
  enterprise: "Enterprise",
};

/**
 * Projecao PUBLICA do catalogo — o formato que `GET /v1/stripe/plans` entrega e
 * que o front consome em `PlanProvider` (`features`), na landing
 * (`use-landing-page.ts`) e no `PlanCard`.
 *
 * Os nomes das chaves sao os historicos (`hasFinancial`, `hasKanban`,
 * `maxStorageMB`) porque ha 30+ consumidores no front presos a eles; renomear
 * seria uma refatoracao sem ganho. As chaves NOVAS sao as que ate agora eram
 * cobradas em silencio ou nao existiam: `maxSpreadsheets` e `maxWallets` ja
 * eram aplicados pelo backend sem aparecer em descricao de plano nenhuma —
 * o cliente descobria no 402 —, e `hasFiscal`/`hasCalendarSync`/`aiMessagesPerMonth`
 * descrevem modulos que existiam sem dono comercial.
 */
export interface PublicPlanFeatures {
  maxProposals: number;
  maxClients: number;
  maxProducts: number;
  maxUsers: number;
  maxWallets: number;
  maxSpreadsheets: number;
  maxPdfTemplates: number;
  maxImagesPerProduct: number;
  maxStorageMB: number;
  aiMessagesPerMonth: number;
  hasFinancial: boolean;
  hasKanban: boolean;
  hasFiscal: boolean;
  hasCalendarSync: boolean;
  hasWhatsApp: boolean;
  canCustomizeTheme: boolean;
  canEditPdfSections: boolean;
}

export function buildPublicPlanFeatures(tier: PlanTierId): PublicPlanFeatures {
  const entry = PLAN_CATALOG[tier];
  return {
    maxProposals: entry.limits.maxProposalsPerMonth,
    maxClients: entry.limits.maxClients,
    maxProducts: entry.limits.maxProducts,
    maxUsers: entry.limits.maxUsers,
    maxWallets: entry.limits.maxWallets,
    maxSpreadsheets: entry.limits.maxSpreadsheets,
    maxPdfTemplates: entry.limits.maxPdfTemplates,
    maxImagesPerProduct: entry.limits.maxImagesPerProduct,
    maxStorageMB: entry.limits.storageQuotaMB,
    aiMessagesPerMonth: entry.limits.aiMessagesPerMonth,
    hasFinancial: entry.capabilities.financial,
    hasKanban: entry.capabilities.crm,
    hasFiscal: entry.capabilities.fiscal,
    hasCalendarSync: entry.capabilities.calendarSync,
    hasWhatsApp: entry.capabilities.whatsapp,
    canCustomizeTheme: entry.capabilities.customTheme,
    canEditPdfSections: entry.capabilities.pdfEditor,
  };
}
