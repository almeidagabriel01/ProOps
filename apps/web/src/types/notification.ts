export enum NotificationType {
  PROPOSAL_VIEWED = "proposal_viewed",
  /** O cliente aceitou pelo link; a empresa precisa confirmar a aprovação. */
  PROPOSAL_ACCEPTED = "proposal_accepted",
  /** O cliente pediu mudanças pelo link, com a justificativa. */
  PROPOSAL_CHANGES_REQUESTED = "proposal_changes_requested",
  /** O cliente aceitou a entrega da obra pelo link. */
  PROJECT_DELIVERY_ACCEPTED = "project_delivery_accepted",
  /** Cliente abriu o link há dias e a proposta segue sem resposta. */
  PROPOSAL_FOLLOW_UP = "proposal_follow_up",
  /** Próxima ação de um lead ou atividade do CRM com prazo hoje. */
  LEAD_REMINDER = "lead_reminder",
  TRANSACTION_DUE_REMINDER = "transaction_due_reminder",
  PROPOSAL_EXPIRING = "proposal_expiring",
  SYSTEM = "system",
  TRANSACTION_VIEWED = "transaction_viewed",
  PRICE_CHANGE = "price_change",
  /** Pagamento online (Asaas) confirmado para um lançamento. */
  TRANSACTION_PAID_ONLINE = "transaction_paid_online",
  /** Alguém atribuiu uma tarefa a você. */
  TASK_ASSIGNED = "task_assigned",
  /** Alguém mencionou você numa tarefa. */
  TASK_MENTIONED = "task_mentioned",
  /** Tarefa sua com prazo hoje. */
  TASK_REMINDER = "task_reminder",
}

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  proposalId?: string;
  sharedProposalId?: string;
  transactionId?: string;
  leadId?: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  /** Quem vê esta notificação (as rules leem este campo). */
  recipientUids?: string[];
  /** Quem já leu: a leitura é por pessoa. */
  readBy?: string[];
  /** Leitura da empresa inteira: só a visão do superadmin usa. */
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationBadgeProps {
  count: number;
}
