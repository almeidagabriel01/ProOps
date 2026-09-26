export enum NotificationType {
  PROPOSAL_VIEWED = "proposal_viewed",
  PROPOSAL_APPROVED = "proposal_approved",
  /** Cliente abriu o link há dias e a proposta segue sem resposta. */
  PROPOSAL_FOLLOW_UP = "proposal_follow_up",
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
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationBadgeProps {
  count: number;
}
