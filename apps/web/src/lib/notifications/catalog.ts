/**
 * Catálogo das notificações na tela: rótulo, grupo e o que cada tipo permite.
 *
 * A decisão de quem recebe e do que sai por e-mail mora no backend
 * (`apps/functions/src/shared/notification-catalog.ts`). Esta cópia existe
 * para a tela de preferências; `notification-catalog-parity.test.ts` falha se
 * as duas divergirem.
 */

export type NotificationAudience = "proposals" | "transactions" | "kanban" | "projects" | "admins";

export type NotificationGroup = "proposals" | "financial" | "crm" | "projects" | "system";

export interface NotificationCatalogEntry {
  label: string;
  description: string;
  group: NotificationGroup;
  audience: NotificationAudience;
  emailable: boolean;
  defaultEmail: boolean;
}

export const NOTIFICATION_CATALOG = {
  proposal_viewed: {
    label: "Proposta visualizada",
    description: "O cliente abriu o link da proposta.",
    group: "proposals",
    audience: "proposals",
    emailable: true,
    defaultEmail: false,
  },
  proposal_accepted: {
    label: "Cliente aceitou a proposta",
    description: "O aceite pelo link espera a sua confirmação.",
    group: "proposals",
    audience: "proposals",
    emailable: true,
    defaultEmail: true,
  },
  proposal_changes_requested: {
    label: "Cliente pediu ajustes",
    description: "O cliente pediu mudanças pelo link, com a justificativa.",
    group: "proposals",
    audience: "proposals",
    emailable: true,
    defaultEmail: true,
  },
  proposal_follow_up: {
    label: "Proposta sem resposta",
    description: "O cliente viu a proposta há dias e não respondeu.",
    group: "proposals",
    audience: "proposals",
    emailable: true,
    defaultEmail: false,
  },
  proposal_expiring: {
    label: "Proposta perto da validade",
    description: "Lembrete diário enquanto a proposta estiver aberta.",
    group: "proposals",
    audience: "proposals",
    emailable: false,
    defaultEmail: false,
  },
  project_delivery_accepted: {
    label: "Entrega da obra aceita",
    description: "O cliente aceitou a entrega pelo link.",
    group: "projects",
    audience: "projects",
    emailable: true,
    defaultEmail: true,
  },
  lead_reminder: {
    label: "Lembrete do CRM",
    description: "Próxima ação de um lead ou atividade com prazo hoje.",
    group: "crm",
    audience: "kanban",
    emailable: false,
    defaultEmail: false,
  },
  transaction_due_reminder: {
    label: "Lançamento vencendo",
    description: "Lembrete diário de lançamento vencido ou perto do vencimento.",
    group: "financial",
    audience: "transactions",
    emailable: false,
    defaultEmail: false,
  },
  transaction_viewed: {
    label: "Cobrança visualizada",
    description: "O cliente abriu o link do lançamento.",
    group: "financial",
    audience: "transactions",
    emailable: true,
    defaultEmail: false,
  },
  transaction_paid_online: {
    label: "Pagamento online recebido",
    description: "O cliente pagou pelo link (PIX, boleto ou cartão).",
    group: "financial",
    audience: "transactions",
    emailable: true,
    defaultEmail: true,
  },
  system: {
    label: "Avisos da conta",
    description: "Certificado digital vencendo, repasse que falhou e afins.",
    group: "system",
    audience: "admins",
    emailable: true,
    defaultEmail: true,
  },
  price_change: {
    label: "Mudança de preço do plano",
    description: "Já chega por e-mail com os valores e o prazo.",
    group: "system",
    audience: "admins",
    emailable: false,
    defaultEmail: false,
  },
} as const satisfies Record<string, NotificationCatalogEntry>;

export type CatalogNotificationType = keyof typeof NOTIFICATION_CATALOG;

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_CATALOG) as CatalogNotificationType[];

export const NOTIFICATION_GROUPS: Array<{ id: NotificationGroup; label: string }> = [
  { id: "proposals", label: "Propostas" },
  { id: "financial", label: "Financeiro" },
  { id: "crm", label: "CRM" },
  { id: "projects", label: "Projetos" },
  { id: "system", label: "Conta" },
];

export function catalogEntry(type: string): NotificationCatalogEntry | undefined {
  return (NOTIFICATION_CATALOG as Record<string, NotificationCatalogEntry>)[type];
}

export interface NotificationChannelPreference {
  inApp?: boolean;
  email?: boolean;
}

export type NotificationPreferences = Partial<
  Record<CatalogNotificationType, NotificationChannelPreference>
>;

/** Mesma regra do backend: sino ligado por padrão, e-mail pelo padrão do tipo. */
export function resolveChannelPreference(
  prefs: NotificationPreferences | undefined,
  type: CatalogNotificationType,
): { inApp: boolean; email: boolean } {
  const entry = NOTIFICATION_CATALOG[type];
  const chosen = prefs?.[type];
  return {
    inApp: chosen?.inApp ?? true,
    email: entry.emailable ? (chosen?.email ?? entry.defaultEmail) : false,
  };
}

/**
 * Tipos que a pessoa recebe, na mesma regra do backend: o dono e os
 * administradores recebem todos; o membro, os dos módulos que ele pode ver.
 */
export function visibleNotificationTypes(
  isAdmin: boolean,
  canView: (pageId: string) => boolean,
): CatalogNotificationType[] {
  return NOTIFICATION_TYPES.filter((type) => {
    const { audience } = NOTIFICATION_CATALOG[type];
    if (isAdmin) return true;
    return audience !== "admins" && canView(audience);
  });
}
