import {
  Proposal,
  ProposalProduct,
  ProposalService,
} from "@/services/proposal-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalStatus, ProposalSystemInstance } from "@/types/proposal";
import { toast } from '@/lib/toast';
import { getPrimaryAmbiente } from "@/lib/sistema-migration-utils";

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
  const normalizeImages = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (
          item &&
          typeof item === "object" &&
          "url" in (item as Record<string, unknown>) &&
          typeof (item as Record<string, unknown>).url === "string"
        ) {
          return String((item as Record<string, unknown>).url).trim();
        }
        return "";
      })
      .filter(Boolean);
  };

  return products.map((p) => {
    const normalizedProductImages = normalizeImages(p.productImages);
    const normalizedProductImage =
      (typeof p.productImage === "string" ? p.productImage.trim() : "") ||
      normalizedProductImages[0] ||
      "";

    return {
      productId: p.productId,
      itemType: p.itemType || "product",
      productName: p.productName,
      quantity:
        typeof p.quantity === "number" && !isNaN(p.quantity)
          ? Math.max(0, p.quantity)
          : 0,
      unitPrice:
        typeof p.unitPrice === "number" && !isNaN(p.unitPrice)
          ? p.unitPrice
          : 0,
      markup: typeof p.markup === "number" && !isNaN(p.markup) ? p.markup : 0,
      total: typeof p.total === "number" && !isNaN(p.total) ? p.total : 0,
      productImage: normalizedProductImage,
      productImages:
        normalizedProductImages.length > 0
          ? normalizedProductImages
          : normalizedProductImage
            ? [normalizedProductImage]
            : [],
      productDescription:
        typeof p.productDescription === "string"
          ? p.productDescription
          : undefined,
      manufacturer: p.manufacturer,
      category: p.category,
      // Support both new and legacy format
      ambienteInstanceId: p.ambienteInstanceId || p.systemInstanceId,
      systemInstanceId: p.systemInstanceId || p.ambienteInstanceId,
      isExtra: p.isExtra,
      status: p.status,
    };
  });
}

function groupProductsByInstanceId(products: ProposalProduct[]) {
  const productsByInstanceId = new Map<string, ProposalProduct[]>();

  products.forEach((product) => {
    const instanceId =
      product.systemInstanceId || product.ambienteInstanceId || "";

    if (!instanceId) return;

    const instanceProducts = productsByInstanceId.get(instanceId) || [];
    instanceProducts.push(product);
    productsByInstanceId.set(instanceId, instanceProducts);
  });

  return productsByInstanceId;
}

// Transform sistemas for API - outputs new format with ambientes array
export function transformSistemas(
  sistemas: ProposalSistema[],
  selectedProducts: ProposalProduct[],
): ProposalSystemInstance[] {
  const productsByInstanceId = groupProductsByInstanceId(selectedProducts);

  return sistemas.map((s) => {
    const primaryAmbiente = getPrimaryAmbiente(s);
    
    // Build ambientes array from new or legacy format
    const ambientes = s.ambientes && s.ambientes.length > 0
      ? s.ambientes.map(a => ({
          ambienteId: a.ambienteId,
          ambienteName: a.ambienteName,
          description: a.description,
          productIds: Array.from(
            new Set(
              (
                productsByInstanceId.get(`${s.sistemaId}-${a.ambienteId}`) ||
                a.products.map((product) => ({
                  productId: product.productId,
                }))
              ).map((product) => product.productId),
            ),
          ),
        }))
      : primaryAmbiente
        ? [{
            ambienteId: primaryAmbiente.ambienteId,
            ambienteName: primaryAmbiente.ambienteName,
            productIds: Array.from(
              new Set(
                (
                  productsByInstanceId.get(
                    `${s.sistemaId}-${primaryAmbiente.ambienteId}`,
                  ) ||
                  primaryAmbiente.products.map((product) => ({
                    productId: product.productId,
                  }))
                ).map((product) => product.productId),
              ),
            ),
          }]
        : [];

    const allProducts = ambientes.flatMap((ambiente) => ambiente.productIds);

    return {
      sistemaId: s.sistemaId,
      sistemaName: s.sistemaName,
      description: s.description,
      ambientes,
      // Legacy fields for backward compat
      ambienteId: primaryAmbiente?.ambienteId,
      ambienteName: primaryAmbiente?.ambienteName,
      productIds: allProducts,
    };
  });
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
    selectedSistemas.length > 0
      ? transformSistemas(selectedSistemas, selectedProducts)
      : [];

  const productsForUpdate = sanitizeProducts(selectedProducts);
  const safeTotal = productsForUpdate.reduce((sum, p) => sum + p.total, 0);
  const discountAmount = (safeTotal * (formData.discount || 0)) / 100;
  const computedTotalValue =
    safeTotal - discountAmount + (formData.extraExpense || 0);

  const downPaymentType = formData.downPaymentType || "value";
  const downPaymentPercentage = formData.downPaymentPercentage || 0;
  const effectiveDownPaymentValue =
    downPaymentType === "percentage"
      ? (computedTotalValue * downPaymentPercentage) / 100
      : formData.downPaymentValue || 0;

  // Ensure empty fields are explicitly saved as empty strings, not null/undefined
  // This prevents Firestore from skipping the field or keeping old values
  const sanitizeStringField = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return "";
    return String(value);
  };
  const proposalLabel = formData.title?.trim()
    ? `"${formData.title.trim()}"`
    : `ID ${proposalId}`;

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
    closedValue: formData.closedValue ?? null,
    extraExpense: formData.extraExpense || 0,
    products: productsForUpdate,
    sistemas: sistemasPayload,
    status: (formData.status as ProposalStatus) || "in_progress",
    // Payment options
    downPaymentEnabled: formData.downPaymentEnabled || false,
    downPaymentType,
    downPaymentPercentage,
    downPaymentValue: effectiveDownPaymentValue,
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

  toast.success(`Proposta ${proposalLabel} foi atualizada com sucesso.`, {
    title: "Sucesso ao editar",
  });
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
  const downPaymentType = formData.downPaymentType || "value";
  const downPaymentPercentage = formData.downPaymentPercentage || 0;
  const effectiveDownPaymentValue =
    downPaymentType === "percentage"
      ? (totalValue * downPaymentPercentage) / 100
      : formData.downPaymentValue || 0;

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
    closedValue: formData.closedValue ?? null,
    extraExpense: formData.extraExpense || 0,
    notes: formData.customNotes,
    customNotes: formData.customNotes,
    products: sanitizedProducts,
    sistemas:
      selectedSistemas.length > 0
        ? transformSistemas(selectedSistemas, selectedProducts)
        : [],
    targetTenantId: tenantId, // Pass tenant ID to backend (for super admin)
    status: (formData.status as ProposalStatus) || "in_progress",
    // Payment options
    downPaymentEnabled: formData.downPaymentEnabled || false,
    downPaymentType,
    downPaymentPercentage,
    downPaymentValue: effectiveDownPaymentValue,
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

