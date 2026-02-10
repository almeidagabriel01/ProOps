export enum NotificationType {
  PROPOSAL_VIEWED = "proposal_viewed",
  PROPOSAL_APPROVED = "proposal_approved",
  TRANSACTION_DUE_REMINDER = "transaction_due_reminder",
  PROPOSAL_EXPIRING = "proposal_expiring",
  SYSTEM = "system",
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
