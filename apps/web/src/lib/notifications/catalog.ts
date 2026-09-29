/**
 * Catálogo das notificações na tela: rótulo, grupo e o que cada tipo permite.
 *
 * A decisão de quem recebe e do que sai por e-mail mora no backend
 * (`apps/functions/src/shared/notification-catalog.ts`). Esta cópia existe
 * para a tela de preferências; `notification-catalog-parity.test.ts` falha se
 * as duas divergirem.
 */

export type NotificationAudience =
  | "proposals"
  | "transactions"
  | "kanban"
  | "projects"
  | "calendar"
  | "admins"
  | "direct";

export type NotificationGroup =
  | "proposals"
  | "financial"
  | "crm"
  | "projects"
  | "tasks"
  | "calendar"
  | "service_orders"
  | "system";

export interface NotificationCatalogEntry {
  label: string;
  description: string;
  group: NotificationGroup;
  audience: NotificationAudience;
  emailable: boolean;
  defaultEmail: boolean;
  /**
   * Só nos diretos: a tela sem a qual a pessoa nunca é destinatária (e o tipo
   * nem aparece nas preferências dela). Padrão: Tarefas.
   */
  directPageId?: string;
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
  project_visit_scheduled: {
    label: "Visita da obra marcada",
    description: "Marcaram ou remarcaram uma etapa de uma obra sua.",
    group: "projects",
    audience: "direct",
    emailable: true,
    defaultEmail: true,
    // Vai para o técnico da obra, que precisa enxergar Projetos.
    directPageId: "projects",
  },
  service_order_assigned: {
    label: "Ordem de serviço para você",
    description: "Passaram uma OS para você atender, ou mudaram a data dela.",
    group: "service_orders",
    audience: "direct",
    emailable: true,
    defaultEmail: true,
    // Vai para o técnico da OS, que precisa enxergar Ordens de serviço.
    directPageId: "service_orders",
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
  task_assigned: {
    label: "Tarefa atribuída a você",
    description: "Alguém da equipe passou uma tarefa para você.",
    group: "tasks",
    audience: "direct",
    emailable: true,
    defaultEmail: true,
  },
  task_mentioned: {
    label: "Menção numa tarefa",
    description: "Alguém citou você com @ numa tarefa.",
    group: "tasks",
    audience: "direct",
    emailable: true,
    defaultEmail: true,
  },
  task_reminder: {
    label: "Tarefa com prazo hoje",
    description: "Lembrete diário das suas tarefas que vencem no dia.",
    group: "tasks",
    audience: "direct",
    emailable: false,
    defaultEmail: false,
  },
  task_updated: {
    label: "Prazo de tarefa alterado",
    description: "Alguém mudou o prazo de uma tarefa sua.",
    group: "tasks",
    audience: "direct",
    emailable: true,
    defaultEmail: false,
  },
  booking_requested: {
    label: "Pedido de visita pelo link",
    description: "Um cliente escolheu um horário no link de agendamento.",
    group: "calendar",
    audience: "calendar",
    emailable: true,
    defaultEmail: true,
  },
} as const satisfies Record<string, NotificationCatalogEntry>;

export type CatalogNotificationType = keyof typeof NOTIFICATION_CATALOG;

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_CATALOG) as CatalogNotificationType[];

export const NOTIFICATION_GROUPS: Array<{ id: NotificationGroup; label: string }> = [
  { id: "proposals", label: "Propostas" },
  { id: "financial", label: "Financeiro" },
  { id: "crm", label: "CRM" },
  { id: "projects", label: "Projetos" },
  { id: "tasks", label: "Tarefas" },
  { id: "calendar", label: "Agenda" },
  { id: "service_orders", label: "Assistência" },
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
 * Os diretos (tarefa atribuída, menção, visita da obra) valem para quem pode
 * ser o destinatário: a tela de Tarefas, ou a de Projetos no caso da visita.
 */
export function visibleNotificationTypes(
  isAdmin: boolean,
  canView: (pageId: string) => boolean,
): CatalogNotificationType[] {
  return NOTIFICATION_TYPES.filter((type) => {
    // Pelo tipo geral: o catálogo é `as const`, e só a visita da obra declara
    // `directPageId`.
    const { audience, directPageId }: NotificationCatalogEntry = NOTIFICATION_CATALOG[type];
    if (isAdmin) return true;
    if (audience === "direct") return canView(directPageId ?? "tasks");
    return audience !== "admins" && canView(audience);
  });
}
