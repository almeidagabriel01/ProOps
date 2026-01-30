import {
  Proposal,
  ProposalProduct,
  ProposalService,
} from "@/services/proposal-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalStatus } from "@/types/proposal";
import { toast } from "react-toastify";

interface CreateProposalPayload {
  formData: Partial<Proposal>;
  selectedProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  clientId?: string;
  tenantId: string;
  calculateTotal: () => number;
}

interface UpdateProposalPayload {
  proposalId: string;
  formData: Partial<Proposal>;
  selectedProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  selectedClientId?: string;
}

// Sanitize products for API
export function sanitizeProducts(products: ProposalProduct[]) {
  return products.map((p) => ({
    productId: p.productId,
    productName: p.productName,
    quantity:
      typeof p.quantity === "number" && !isNaN(p.quantity)
        ? Math.max(1, p.quantity)
        : 1,
    unitPrice:
      typeof p.unitPrice === "number" && !isNaN(p.unitPrice) ? p.unitPrice : 0,
    markup: typeof p.markup === "number" && !isNaN(p.markup) ? p.markup : 0,
    total: typeof p.total === "number" && !isNaN(p.total) ? p.total : 0,
    manufacturer: p.manufacturer,
    category: p.category,
    systemInstanceId: p.systemInstanceId,
    isExtra: p.isExtra,
  }));
}

// Transform sistemas for API
export function transformSistemas(sistemas: ProposalSistema[]) {
  return sistemas.map((s) => ({
    sistemaId: s.sistemaId,
    sistemaName: s.sistemaName,
    ambienteId: s.ambienteId,
    ambienteName: s.ambienteName,
    description: s.description,
    productIds: s.products.map((p) => p.productId),
  }));
}

// Update existing proposal
export async function updateProposal(
  payload: UpdateProposalPayload,
): Promise<void> {
  const {
    proposalId,
    formData,
    selectedProducts,
    selectedSistemas,
    selectedClientId,
  } = payload;

  const sistemasPayload =
    selectedSistemas.length > 0 ? transformSistemas(selectedSistemas) : [];

  const productsForUpdate = sanitizeProducts(selectedProducts);

  // Ensure empty fields are explicitly saved as empty strings, not null/undefined
  // This prevents Firestore from skipping the field or keeping old values
  const sanitizeStringField = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return "";
    return String(value);
  };

  await ProposalService.updateProposal(proposalId, {
    title: formData.title,
    clientId: selectedClientId,
    clientName: formData.clientName,
    clientEmail: sanitizeStringField(formData.clientEmail),
    clientPhone: sanitizeStringField(formData.clientPhone),
    clientAddress: sanitizeStringField(formData.clientAddress),
    validUntil: sanitizeStringField(formData.validUntil),
    customNotes: sanitizeStringField(formData.customNotes),
    discount: formData.discount || 0,
    extraExpense: formData.extraExpense || 0,
    products: productsForUpdate,
    sistemas: sistemasPayload,
    status: (formData.status as ProposalStatus) || "in_progress",
    // Payment options
    downPaymentEnabled: formData.downPaymentEnabled || false,
    downPaymentValue: formData.downPaymentValue || 0,
    downPaymentWallet: formData.downPaymentWallet || "",
    downPaymentDueDate: formData.downPaymentDueDate || "",
    installmentsEnabled: formData.installmentsEnabled || false,
    installmentsCount: formData.installmentsCount || 1,
    installmentValue: formData.installmentValue || 0,
    installmentsWallet: formData.installmentsWallet || "",
    firstInstallmentDate: formData.firstInstallmentDate || "",
    // PDF display settings (persisted for correct PDF rendering)
    pdfSettings: formData.pdfSettings || undefined,
  });

  toast.success("Proposta atualizada com sucesso!");
}

// Prepare proposal data for creation
export function prepareCreatePayload(payload: CreateProposalPayload) {
  const {
    formData,
    selectedProducts,
    selectedSistemas,
    clientId,
    tenantId,
    calculateTotal,
  } = payload;

  const sanitizedProducts = sanitizeProducts(selectedProducts);
  const safeTotal = calculateTotal();
  const totalValue =
    typeof safeTotal === "number" && !isNaN(safeTotal) ? safeTotal : 0;

  // Ensure empty fields are explicitly saved as empty strings, not null/undefined
  // This prevents Firestore from skipping the field or keeping old values
  const sanitizeStringField = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return "";
    return String(value);
  };

  return {
    title: formData.title || "", // Allow empty title for drafts (backend handles default)
    clientId: clientId || "", // Allow empty client for drafts
    clientName: formData.clientName || "",
    clientEmail: sanitizeStringField(formData.clientEmail),
    clientPhone: sanitizeStringField(formData.clientPhone),
    clientAddress: sanitizeStringField(formData.clientAddress),
    validUntil: sanitizeStringField(formData.validUntil),
    totalValue: totalValue,
    discount: formData.discount || 0,
    extraExpense: formData.extraExpense || 0,
    notes: formData.customNotes,
    customNotes: formData.customNotes,
    products: sanitizedProducts,
    sistemas:
      selectedSistemas.length > 0 ? transformSistemas(selectedSistemas) : [],
    targetTenantId: tenantId, // Pass tenant ID to backend (for super admin)
    status: (formData.status as ProposalStatus) || "in_progress",
    // Payment options
    downPaymentEnabled: formData.downPaymentEnabled || false,
    downPaymentValue: formData.downPaymentValue || 0,
    downPaymentWallet: formData.downPaymentWallet || "",
    downPaymentDueDate: formData.downPaymentDueDate || "",
    installmentsEnabled: formData.installmentsEnabled || false,
    installmentsCount: formData.installmentsCount || 1,
    installmentValue: formData.installmentValue || 0,
    installmentsWallet: formData.installmentsWallet || "",
    firstInstallmentDate: formData.firstInstallmentDate || "",
    // PDF display settings (persisted for correct PDF rendering)
    pdfSettings: formData.pdfSettings || undefined,
  };
}
