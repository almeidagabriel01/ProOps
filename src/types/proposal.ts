import { PdfDisplaySettings } from "./pdf-display-settings";

export type ProposalStatus =
  | "draft"
  | "in_progress"
  | "sent"
  | "approved"
  | "rejected";

export interface ProposalProduct {
  productId: string;
  name?: string; // Legacy/Optional
  productName: string; // Used in components
  quantity: number;
  unitPrice: number; // Used in components (base/cost price)
  markup?: number; // Profit percentage
  total: number;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  manufacturer?: string;
  category?: string;
  // Novo: identificador composto sistemaId-ambienteId
  ambienteInstanceId?: string;
  // DEPRECATED: Mantido para migração
  /** @deprecated Use ambienteInstanceId instead */
  systemInstanceId?: string;
  isExtra?: boolean;
  isMonthly?: boolean;
  status?: "active" | "inactive";
  _isInactive?: boolean; // Metadata flag for PDF visual hiding
  _isGhost?: boolean;
  _shouldHide?: boolean;
}

/**
 * Ambiente dentro de um sistema na proposta
 */
export interface ProposalAmbienteInstance {
  ambienteId: string;
  ambienteName: string;
  description?: string;
  productIds: string[];
}

/**
 * Sistema na proposta com múltiplos ambientes
 */
export interface ProposalSystemInstance {
  sistemaId: string;
  sistemaName: string;
  description?: string;
  // Novo: array de ambientes dentro do sistema
  ambientes: ProposalAmbienteInstance[];
  // DEPRECATED: Mantido para migração
  /** @deprecated Use ambientes[0].ambienteId instead */
  ambienteId?: string;
  /** @deprecated Use ambientes[0].ambienteName instead */
  ambienteName?: string;
  /** @deprecated Use ambientes[].productIds instead */
  productIds?: string[];
}

export interface ProposalAttachment {
  id: string;
  name: string;
  url: string;
  type: "image" | "pdf";
  size: number;
  uploadedAt: string;
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
  sistemas: ProposalSystemInstance[];
  sections: Record<string, unknown>[];
  discount?: number;
  totalValue?: number;
  extraExpense?: number; // Additional expense (reduces total but not profit)
  customNotes?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  pdfSettings?: PdfDisplaySettings;
  attachments?: ProposalAttachment[];
  // Payment options
  downPaymentEnabled?: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  downPaymentValue?: number;
  downPaymentWallet?: string; // Internal use only - not shown in PDF
  downPaymentDueDate?: string; // YYYY-MM-DD
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  installmentsWallet?: string; // Internal use only - not shown in PDF
  firstInstallmentDate?: string; // YYYY-MM-DD - date of first installment

  // Flattened fields for sorting
  primarySystem?: string;
  primaryEnvironment?: string;
}
