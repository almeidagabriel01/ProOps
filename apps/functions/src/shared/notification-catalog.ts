/**
 * Catálogo das notificações: para quem cada tipo vai e se pode sair por e-mail.
 *
 * É a fonte única dessa decisão. O backend resolve os destinatários daqui na
 * criação; a tela de preferências (`apps/web/src/lib/notifications/catalog.ts`)
 * tem uma cópia com os rótulos, e `notification-catalog-parity.test.ts` falha
 * se as duas divergirem.
 *
 * `audience` é o `pageId` que a pessoa precisa poder VER para receber o tipo
 * (a mesma chave da tela de Equipe, nunca uma inventada), `admins` para o que
 * só o dono e os administradores recebem, ou `direct` para o que é endereçado
 * a pessoas escolhidas por quem criou (tarefa atribuída, menção): ali quem
 * recebe é só quem foi citado, e a notificação exige a lista de destinatários.
 *
 * Os lembretes diários (vencimento, proposta expirando, CRM) não saem por
 * e-mail: repetem todo dia enquanto a pendência existir, e um e-mail por item
 * por dia seria ruído. Eles pertencem ao resumo diário.
 */

export const NOTIFICATION_TYPES = [
  "proposal_viewed",
  "proposal_accepted",
  "proposal_changes_requested",
  "proposal_follow_up",
  "proposal_expiring",
  "project_delivery_accepted",
  "lead_reminder",
  "transaction_due_reminder",
  "transaction_viewed",
  "transaction_paid_online",
  "system",
  "price_change",
  "task_assigned",
  "task_mentioned",
  "task_reminder",
  "task_updated",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationAudience =
  | "proposals"
  | "transactions"
  | "kanban"
  | "projects"
  | "admins"
  | "direct";

export interface NotificationCatalogEntry {
  audience: NotificationAudience;
  emailable: boolean;
  /** Vale só quando `emailable`: e-mail ligado para quem nunca mexeu. */
  defaultEmail: boolean;
}

export const NOTIFICATION_CATALOG: Record<NotificationType, NotificationCatalogEntry> = {
  proposal_viewed: { audience: "proposals", emailable: true, defaultEmail: false },
  proposal_accepted: { audience: "proposals", emailable: true, defaultEmail: true },
  proposal_changes_requested: { audience: "proposals", emailable: true, defaultEmail: true },
  proposal_follow_up: { audience: "proposals", emailable: true, defaultEmail: false },
  proposal_expiring: { audience: "proposals", emailable: false, defaultEmail: false },
  project_delivery_accepted: { audience: "projects", emailable: true, defaultEmail: true },
  lead_reminder: { audience: "kanban", emailable: false, defaultEmail: false },
  transaction_due_reminder: { audience: "transactions", emailable: false, defaultEmail: false },
  transaction_viewed: { audience: "transactions", emailable: true, defaultEmail: false },
  transaction_paid_online: { audience: "transactions", emailable: true, defaultEmail: true },
  system: { audience: "admins", emailable: true, defaultEmail: true },
  // O aviso de preço já tem e-mail próprio, com os valores e o prazo.
  price_change: { audience: "admins", emailable: false, defaultEmail: false },
  task_assigned: { audience: "direct", emailable: true, defaultEmail: true },
  task_mentioned: { audience: "direct", emailable: true, defaultEmail: true },
  // Lembrete diário: fica no sino, como os outros.
  task_reminder: { audience: "direct", emailable: false, defaultEmail: false },
  task_updated: { audience: "direct", emailable: true, defaultEmail: false },
};

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export interface NotificationChannelPreference {
  inApp?: boolean;
  email?: boolean;
}

export type NotificationPreferences = Partial<
  Record<NotificationType, NotificationChannelPreference>
>;

/** Preferência efetiva de um tipo: o que a pessoa escolheu, ou o padrão. */
export function resolveChannelPreference(
  prefs: NotificationPreferences | undefined,
  type: NotificationType,
): { inApp: boolean; email: boolean } {
  const entry = NOTIFICATION_CATALOG[type];
  const chosen = prefs?.[type];
  return {
    inApp: chosen?.inApp ?? true,
    email: entry.emailable ? (chosen?.email ?? entry.defaultEmail) : false,
  };
}

/**
 * Caminho da tela que resolve a notificação. O sino e o e-mail levam ao mesmo
 * lugar; a cópia do front fica em `apps/web/src/lib/notifications/links.ts`.
 */
export function notificationLinkPath(n: {
  type: string;
  proposalId?: string | null;
  transactionId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
}): string {
  switch (n.type) {
    case "transaction_due_reminder":
    case "transaction_viewed":
    case "transaction_paid_online":
      return "/transactions";
    case "lead_reminder":
      if (n.leadId) return `/crm?tab=leads&lead=${n.leadId}`;
      return n.clientId ? `/contacts/${n.clientId}` : "/crm?tab=leads";
    case "proposal_accepted":
      return n.proposalId ? `/proposals?aceite=${n.proposalId}` : "/proposals";
    case "proposal_changes_requested":
      return n.proposalId ? `/proposals?ajuste=${n.proposalId}` : "/proposals";
    case "project_delivery_accepted":
      return n.projectId ? `/projects/${n.projectId}` : "/projects";
    case "task_assigned":
    case "task_mentioned":
    case "task_reminder":
    case "task_updated":
      return n.taskId ? `/tasks?task=${n.taskId}` : "/tasks";
    default:
      return n.proposalId ? `/proposals/${n.proposalId}/view` : "/notifications";
  }
}
