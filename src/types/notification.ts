export enum NotificationType {
  PROPOSAL_VIEWED = "proposal_viewed",
  PROPOSAL_APPROVED = "proposal_approved",
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
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationBadgeProps {
  count: number;
}
