export interface SharedProposal {
  id: string;
  proposalId: string;
  tenantId: string;
  token: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  viewedAt?: string;
  viewerInfo?: ViewerInfo[];
}

export interface ViewerInfo {
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

export interface ShareLinkResponse {
  shareUrl: string;
  token: string;
  expiresAt: string;
}
