export enum NotificationType {
  PROPOSAL_VIEWED = "proposal_viewed",
  /** O cliente aceitou pelo link; a empresa precisa confirmar a aprovação. */
  PROPOSAL_ACCEPTED = "proposal_accepted",
  /** O cliente pediu mudanças pelo link, com a justificativa. */
  PROPOSAL_CHANGES_REQUESTED = "proposal_changes_requested",
  /** Cliente abriu o link há dias e a proposta segue sem resposta. */
  PROPOSAL_FOLLOW_UP = "proposal_follow_up",
  /** Próxima ação de um lead ou atividade do CRM com prazo hoje. */
  LEAD_REMINDER = "lead_reminder",
  TRANSACTION_DUE_REMINDER = "transaction_due_reminder",
  PROPOSAL_EXPIRING = "proposal_expiring",
  SYSTEM = "system",
  TRANSACTION_VIEWED = "transaction_viewed",
  PRICE_CHANGE = "price_change",
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
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationBadgeProps {
  count: number;
}
