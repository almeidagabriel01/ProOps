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
  systemInstanceId?: string;
  isExtra?: boolean;
  isMonthly?: boolean;
}

export interface ProposalSystemInstance {
  sistemaId?: string; // Optional/Partial if only environment selected
  ambienteId: string;
  sistemaName?: string; // Optional if no system
  ambienteName: string;
  description?: string;
  productIds: string[];
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
  // Payment options
  downPaymentEnabled?: boolean;
  downPaymentValue?: number;
  downPaymentWallet?: string; // Internal use only - not shown in PDF
  downPaymentDueDate?: string; // YYYY-MM-DD
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  installmentsWallet?: string; // Internal use only - not shown in PDF
  firstInstallmentDate?: string; // YYYY-MM-DD - date of first installment
}
