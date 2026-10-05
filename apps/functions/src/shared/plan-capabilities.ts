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
 *
 * `driveSync` fica na MESMA faixa do `calendarSync`, e nao numa acima: as duas
 * usam o mesmo consentimento Google e resolvem a mesma dor — nao manter duas
 * organizacoes, uma no ERP e outra fora dele. Separa-las confundiria na venda.
 *
 * `onlinePayments` e o pagamento da parcela pelo link compartilhado (Asaas).
 * Ate 2026-09 ele vinha junto do `financial`; separou para ser nativo so no
 * Enterprise e vendido como add-on nos demais.
 *
 * `onlineApproval` e o cliente final aprovar a proposta pelo link
 * compartilhado (aceite com nome e documento). Pro e Enterprise.
 *
 * `projects` e o acompanhamento da obra depois da venda: projeto (ordem de
 * servico de instalacao) com etapas, checklist, fotos, tecnico responsavel e
 * aceite da entrega pelo link. Pro e Enterprise.
 *
 * `salesGoals` sao as metas de vendas: meta mensal da empresa e de cada
 * vendedor (membro escolhido na proposta), com o progresso pelo valor das
 * propostas aprovadas no mes da aprovacao. Pro e Enterprise.
 *
 * `bookingLink` e o link publico de agendamento: o cliente escolhe um horario
 * livre no expediente da empresa e pede a visita, que a empresa confirma. Pro
 * e Enterprise.
 *
 * `clientPortal` e o portal do cliente: uma pagina por contato, aberta por um
 * link fixo e revogavel, com as propostas, os pagamentos, a obra e os
 * documentos dele. Pro e Enterprise.
 *
 * `fieldService` e a assistencia tecnica: equipamentos do cliente (o parque
 * instalado, com garantia e historico) e a ordem de servico, executada no
 * celular pelo tecnico e assinada pelo cliente na tela. Pro e Enterprise;
 * Starter compra pelo add-on `field_service`.
 *
 * `priceTables` sao as tabelas de preco: alem do catalogo (a tabela padrao),
 * tabelas especificas com um ajuste percentual sobre tudo e, opcionalmente,
 * preco proprio por produto ou servico, escolhidas no cadastro do cliente e
 * aplicadas nas propostas dele. Pro e Enterprise; nao e add-on.
 *
 * `fiscalReceiving` e a recepcao de notas de ENTRADA. Fica fora do add-on
 * fiscal de proposito: cada nota recebida consome uma unidade paga do Focus
 * sem clique de ninguem, entao nao cabe na franquia mensal do add-on.
 */
export type PlanCapabilityKey =
  | "financial"
  | "crm"
  | "fiscal"
  | "pdfEditor"
  | "customTheme"
  | "whatsapp"
  | "calendarSync"
  | "driveSync"
  | "onlinePayments"
  | "onlineApproval"
  | "projects"
  | "salesGoals"
  | "bookingLink"
  | "clientPortal"
  | "fieldService"
  | "priceTables"
  | "fiscalReceiving";

export type PlanCapabilities = Record<PlanCapabilityKey, boolean>;

export interface PlanNumericLimits {
  maxProposalsPerMonth: number;
  maxClients: number;
  maxProducts: number;
  maxUsers: number;
  maxWallets: number;
  maxSpreadsheets: number;
  /** Notas fiscais emitidas por mes. So o add-on fiscal usa teto finito. */
  maxInvoicesPerMonth: number;
  maxPdfTemplates: number;
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
  "driveSync",
  "onlinePayments",
  "onlineApproval",
  "projects",
  "salesGoals",
  "bookingLink",
  "clientPortal",
  "fieldService",
  "priceTables",
  "fiscalReceiving",
] as const;

const NO_CAPABILITIES: PlanCapabilities = {
  financial: false,
  crm: false,
  fiscal: false,
  pdfEditor: false,
  customTheme: false,
  whatsapp: false,
  calendarSync: false,
  driveSync: false,
  onlinePayments: false,
  onlineApproval: false,
  projects: false,
  salesGoals: false,
  bookingLink: false,
  clientPortal: false,
  fieldService: false,
  priceTables: false,
  fiscalReceiving: false,
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
      maxInvoicesPerMonth: 0,
      maxPdfTemplates: 1,
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
      maxSpreadsheets: 5,
      maxInvoicesPerMonth: 0,
      maxPdfTemplates: 1,
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
      driveSync: true,
      onlineApproval: true,
      projects: true,
      salesGoals: true,
      bookingLink: true,
      clientPortal: true,
      fieldService: true,
      priceTables: true,
    },
    limits: {
      maxProposalsPerMonth: -1,
      maxClients: -1,
      maxProducts: -1,
      maxUsers: 2,
      maxWallets: 30,
      maxSpreadsheets: 50,
      maxInvoicesPerMonth: 0,
      maxPdfTemplates: -1,
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
      driveSync: true,
      onlinePayments: true,
      onlineApproval: true,
      projects: true,
      salesGoals: true,
      bookingLink: true,
      clientPortal: true,
      fieldService: true,
      priceTables: true,
      fiscalReceiving: true,
    },
    limits: {
      maxProposalsPerMonth: -1,
      maxClients: -1,
      maxProducts: -1,
      maxUsers: -1,
      maxWallets: -1,
      maxSpreadsheets: -1,
      maxInvoicesPerMonth: -1,
      maxPdfTemplates: -1,
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

/** Nome de cada modulo como o cliente o conhece (mensagem de 402, painel do superadmin). */
export const CAPABILITY_LABELS: Record<PlanCapabilityKey, string> = {
  financial: "Financeiro",
  crm: "CRM",
  fiscal: "Notas Fiscais",
  pdfEditor: "Editor de PDF",
  customTheme: "Cores personalizadas",
  whatsapp: "WhatsApp",
  calendarSync: "Google Agenda",
  driveSync: "Google Drive",
  onlinePayments: "Pagamento online",
  onlineApproval: "Aceite online da proposta",
  projects: "Projetos de instalação",
  salesGoals: "Metas de vendas",
  bookingLink: "Link de agendamento",
  clientPortal: "Portal do cliente",
  fieldService: "Ordens de serviço, equipamentos e contratos",
  priceTables: "Tabelas de preço",
  fiscalReceiving: "Notas de entrada",
};

export const LIMIT_LABELS: Record<keyof PlanNumericLimits, string> = {
  maxProposalsPerMonth: "Propostas por mês",
  maxClients: "Contatos",
  maxProducts: "Produtos",
  maxUsers: "Usuários da equipe",
  maxWallets: "Carteiras",
  maxSpreadsheets: "Planilhas",
  maxInvoicesPerMonth: "Notas fiscais por mês",
  maxPdfTemplates: "Modelos de PDF",
  storageQuotaMB: "Armazenamento (MB)",
  aiMessagesPerMonth: "Mensagens da Lia por mês",
};

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
  maxInvoicesPerMonth: number;
  maxPdfTemplates: number;
  maxStorageMB: number;
  aiMessagesPerMonth: number;
  hasFinancial: boolean;
  hasKanban: boolean;
  hasFiscal: boolean;
  hasCalendarSync: boolean;
  hasDriveSync: boolean;
  hasOnlinePayments: boolean;
  hasOnlineApproval: boolean;
  hasProjects: boolean;
  hasSalesGoals: boolean;
  hasBookingLink: boolean;
  hasClientPortal: boolean;
  hasFieldService: boolean;
  hasPriceTables: boolean;
  hasFiscalReceiving: boolean;
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
    maxInvoicesPerMonth: entry.limits.maxInvoicesPerMonth,
    maxPdfTemplates: entry.limits.maxPdfTemplates,
    maxStorageMB: entry.limits.storageQuotaMB,
    aiMessagesPerMonth: entry.limits.aiMessagesPerMonth,
    hasFinancial: entry.capabilities.financial,
    hasKanban: entry.capabilities.crm,
    hasFiscal: entry.capabilities.fiscal,
    hasCalendarSync: entry.capabilities.calendarSync,
    hasDriveSync: entry.capabilities.driveSync,
    hasOnlinePayments: entry.capabilities.onlinePayments,
    hasOnlineApproval: entry.capabilities.onlineApproval,
    hasProjects: entry.capabilities.projects,
    hasSalesGoals: entry.capabilities.salesGoals,
    hasBookingLink: entry.capabilities.bookingLink,
    hasClientPortal: entry.capabilities.clientPortal,
    hasFieldService: entry.capabilities.fieldService,
    hasPriceTables: entry.capabilities.priceTables,
    hasFiscalReceiving: entry.capabilities.fiscalReceiving,
    hasWhatsApp: entry.capabilities.whatsapp,
    canCustomizeTheme: entry.capabilities.customTheme,
    canEditPdfSections: entry.capabilities.pdfEditor,
  };
}
