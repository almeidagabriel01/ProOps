import { Proposal, ProposalProduct, ProposalService } from "@/services/proposal-service";
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
  return products.map(p => ({
    productId: p.productId,
    productName: p.productName,
    quantity: typeof p.quantity === 'number' && !isNaN(p.quantity) ? Math.max(1, p.quantity) : 1,
    unitPrice: typeof p.unitPrice === 'number' && !isNaN(p.unitPrice) ? p.unitPrice : 0,
    total: typeof p.total === 'number' && !isNaN(p.total) ? p.total : 0,
    manufacturer: p.manufacturer,
    category: p.category,
    systemInstanceId: p.systemInstanceId,
    isExtra: p.isExtra,
  }));
}

// Transform sistemas for API
export function transformSistemas(sistemas: ProposalSistema[]) {
  return sistemas.map(s => ({
    sistemaId: s.sistemaId,
    sistemaName: s.sistemaName,
    ambienteId: s.ambienteId,
    ambienteName: s.ambienteName,
    description: s.description,
    productIds: s.products.map(p => p.productId)
  }));
}

// Update existing proposal
export async function updateProposal(payload: UpdateProposalPayload): Promise<void> {
  const { proposalId, formData, selectedProducts, selectedSistemas, selectedClientId } = payload;
  
  const sistemasPayload = selectedSistemas.length > 0 
    ? transformSistemas(selectedSistemas) 
    : [];

  const productsForUpdate = sanitizeProducts(selectedProducts);

  await ProposalService.updateProposal(proposalId, {
    title: formData.title,
    clientId: selectedClientId,
    clientName: formData.clientName,
    clientEmail: formData.clientEmail || undefined,
    clientPhone: formData.clientPhone || undefined,
    clientAddress: formData.clientAddress || undefined,
    validUntil: formData.validUntil || undefined,
    customNotes: formData.customNotes || undefined,
    discount: formData.discount || 0,
    products: productsForUpdate,
    sistemas: sistemasPayload,
    status: (formData.status as ProposalStatus) || "draft",
  });
  
  toast.success("Proposta atualizada com sucesso!");
}

// Prepare proposal data for creation
export function prepareCreatePayload(payload: CreateProposalPayload) {
  const { formData, selectedProducts, selectedSistemas, clientId, tenantId, calculateTotal } = payload;
  
  const sanitizedProducts = sanitizeProducts(selectedProducts);
  const safeTotal = calculateTotal();
  const totalValue = typeof safeTotal === 'number' && !isNaN(safeTotal) ? safeTotal : 0;

  return {
    title: formData.title!,
    clientId: clientId!,
    clientName: formData.clientName!,
    clientEmail: formData.clientEmail || undefined,
    clientPhone: formData.clientPhone || undefined,
    clientAddress: formData.clientAddress || undefined,
    validUntil: formData.validUntil || undefined,
    totalValue: totalValue,
    discount: formData.discount || 0,
    notes: formData.customNotes,
    customNotes: formData.customNotes,
    products: sanitizedProducts,
    sistemas: selectedSistemas.length > 0 
      ? transformSistemas(selectedSistemas) 
      : undefined,
    targetTenantId: tenantId, // Pass tenant ID to backend (for super admin)
    status: (formData.status as ProposalStatus) || "draft",
  };
}
