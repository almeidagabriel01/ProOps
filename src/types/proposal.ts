export type ProposalStatus = "draft" | "sent" | "approved" | "rejected";

export interface ProposalProduct {
  productId: string;
  name?: string; // Legacy/Optional
  productName: string; // Used in components
  quantity: number;
  price?: number; // Legacy/Optional
  unitPrice: number; // Used in components
  total: number;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  manufacturer?: string;
  category?: string;
  systemInstanceId?: string;
  isExtra?: boolean;
  isMonthly?: boolean;
}

export interface Proposal {
  id: string;
  tenantId: string;
  title: string;
  status: ProposalStatus;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  validUntil?: string;
  products: ProposalProduct[];
  sistemas: Record<string, unknown>[];
  sections: Record<string, unknown>[];
  discount?: number;
  totalValue?: number;
  customNotes?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  pdfSettings?: Record<string, unknown>;
}
