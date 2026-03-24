import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { ProposalStatus } from "@/types";
import { mergePdfDisplaySettings } from "@/types/pdf-display-settings";
import { DEFAULT_PROPOSAL_PAYMENT_METHOD } from "@/lib/proposal-payment";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EMPTY_ARRAY: any[] = [];

export function createInitialProposalFormData(): Partial<Proposal> {
  return {
    title: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    validUntil: "",
    customNotes: "",
    discount: 0,
    closedValue: null,
    extraExpense: 0,
    products: [],
    status: "in_progress" as ProposalStatus,
    downPaymentEnabled: false,
    downPaymentType: "value",
    downPaymentPercentage: undefined,
    downPaymentValue: 0,
    downPaymentWallet: "",
    downPaymentDueDate: "",
    downPaymentMethod: DEFAULT_PROPOSAL_PAYMENT_METHOD,
    installmentsEnabled: false,
    installmentsCount: 1,
    installmentValue: 0,
    installmentsWallet: "",
    firstInstallmentDate: "",
    installmentsPaymentMethod: DEFAULT_PROPOSAL_PAYMENT_METHOD,
    paymentMethod: DEFAULT_PROPOSAL_PAYMENT_METHOD,
    pdfSettings: {
      showProductImages: true,
      showProductDescriptions: true,
      showProductPrices: false,
      showProductMeasurements: true,
      showSubtotals: true,
      showEnvironmentSubtotals: false,
      showPaymentTerms: true,
      showLogo: true,
      showValidUntil: true,
      showNotes: true,
    },
  };
}

function mapSnapshotProducts(
  products: ProposalProduct[] = [],
  includeFullDetails: boolean,
) {
  return products.map((p) => {
    if (!includeFullDetails) {
      return {
        lineItemId: p.lineItemId,
        productId: p.productId,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        markup: p.markup,
        pricingDetails: p.pricingDetails,
        systemInstanceId: p.systemInstanceId,
        isExtra: p.isExtra,
        status: p.status,
      };
    }

    return {
      lineItemId: p.lineItemId,
      productId: p.productId,
      productName: p.productName,
      productImage: p.productImage,
      productImages: p.productImages,
      productDescription: p.productDescription,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      markup: p.markup,
      pricingDetails: p.pricingDetails,
      total: p.total,
      manufacturer: p.manufacturer,
      category: p.category,
      systemInstanceId: p.systemInstanceId,
      isExtra: p.isExtra,
      status: p.status,
    };
  });
}

function buildFormSnapshotObject(
  data: Partial<Proposal>,
  includeFullProductDetails: boolean,
) {
  return {
    title: data.title || "",
    clientName: data.clientName || "",
    clientEmail: data.clientEmail || "",
    clientPhone: data.clientPhone || "",
    clientAddress: data.clientAddress || "",
    validUntil: data.validUntil || "",
    customNotes: data.customNotes || "",
    discount: data.discount || 0,
    closedValue: data.closedValue ?? null,
    extraExpense: data.extraExpense || 0,
    status: data.status || "in_progress",
    products: mapSnapshotProducts(
      (data.products as ProposalProduct[]) || [],
      includeFullProductDetails,
    ),
    downPaymentEnabled: data.downPaymentEnabled || false,
    downPaymentType: data.downPaymentType || "value",
    downPaymentPercentage: data.downPaymentPercentage,
    downPaymentValue: data.downPaymentValue || 0,
    downPaymentWallet: data.downPaymentWallet || "",
    downPaymentDueDate: data.downPaymentDueDate || "",
    downPaymentMethod:
      data.downPaymentMethod ||
      data.paymentMethod ||
      DEFAULT_PROPOSAL_PAYMENT_METHOD,
    installmentsEnabled: data.installmentsEnabled || false,
    installmentsCount: data.installmentsCount || 1,
    installmentValue: data.installmentValue || 0,
    installmentsWallet: data.installmentsWallet || "",
    firstInstallmentDate: data.firstInstallmentDate || "",
    installmentsPaymentMethod:
      data.installmentsPaymentMethod ||
      data.paymentMethod ||
      DEFAULT_PROPOSAL_PAYMENT_METHOD,
    paymentMethod: data.paymentMethod || DEFAULT_PROPOSAL_PAYMENT_METHOD,
    pdfSettings: mergePdfDisplaySettings(data.pdfSettings),
  };
}

export function buildFullFormSnapshot(data: Partial<Proposal>): string {
  return JSON.stringify(buildFormSnapshotObject(data, true));
}

export function buildEssentialFormSnapshot(data: Partial<Proposal>): string {
  return JSON.stringify(buildFormSnapshotObject(data, false));
}

