import { PdfDisplaySettings } from "./pdf-display-settings";
import { ProposalProductPricingDetails } from "@/lib/product-pricing";

export type ProposalStatus =
  | "draft"
  | "in_progress"
  | "sent"
  | "approved"
  | "rejected"
  | (string & {}); // Allows any custom standard from Kanban Column IDs


export interface ProposalProduct {
  lineItemId?: string;
  productId: string;
  itemType?: "product" | "service";
  name?: string; // Legacy/Optional
  productName: string; // Used in components
  quantity: number;
  unitPrice: number; // Used in components (base/cost price)
  markup?: number; // Profit percentage
  priceManuallyEdited?: boolean;
  pricingDetails?: ProposalProductPricingDetails;
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
  storagePath?: string;
  type: "image" | "pdf";
  size: number;
  uploadedAt: string;
}

/**
 * Comissao de um parceiro sobre esta proposta.
 *
 * O percentual e copiado do cadastro do contato ao adicionar, mas o que vale e
 * o valor gravado AQUI: mudar a comissao padrao do parceiro nao pode reescrever
 * o que ja foi combinado numa proposta.
 */
export interface ProposalCommission {
  contactId: string;
  /** Desnormalizado, no mesmo padrao de `clientName`. */
  contactName: string;
  role: "vendedor" | "arquiteto";
  percentage: number;
}

export interface ProposalPdfMetadata {
  storagePath: string;
  versionHash: string;
  updatedAt?: string;
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
  closedValue?: number | null; // Final negotiated value that overrides the total when approved
  extraExpense?: number; // Additional expense (reduces total but not profit)
  customNotes?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  pdfSettings?: PdfDisplaySettings;
  pdf?: ProposalPdfMetadata;
  attachments?: ProposalAttachment[];
  // Payment options
  downPaymentEnabled?: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  downPaymentValue?: number;
  downPaymentWallet?: string; // Internal use only - not shown in PDF
  downPaymentDueDate?: string; // YYYY-MM-DD
  downPaymentMethod?: string; // Shown in PDF for entry
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  installmentsWallet?: string; // Internal use only - not shown in PDF
  firstInstallmentDate?: string; // YYYY-MM-DD - date of first installment
  installmentsPaymentMethod?: string; // Shown in PDF for installments/single payment
  paymentMethod?: string; // Shown in PDF payment terms

  /**
   * Comissoes de vendedor e arquiteto. Informacao INTERNA: nao entra no PDF,
   * como `downPaymentWallet` e `installmentsWallet` tambem nao entram.
   */
  commissions?: ProposalCommission[];

  /**
   * Numeracao da proposta, quando a empresa liga a funcionalidade em
   * /settings/proposals. `proposalCode` e o identificador montado
   * (ex. "0018926SP"); os tres campos ao lado ficam guardados a parte porque
   * relatorio e filtro perguntam por ano e por praca, nao pela string inteira.
   *
   * Alocados pelo backend na CRIACAO e imutaveis depois: e um numero de
   * documento, e uma proposta ja enviada ao cliente nao pode trocar de
   * identificador porque alguem corrigiu o titulo.
   */
  proposalNumber?: number | null;
  proposalYear?: number | null;
  proposalPraca?: string | null;
  proposalCode?: string | null;

  // Flattened fields for sorting
  primarySystem?: string;
  primaryEnvironment?: string;
}
