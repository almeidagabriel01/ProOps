export type FiscalProvider = "focus_nfe";
export type FiscalEnvironment = "homologation" | "production";
export type FiscalOnboardingStatus = "incomplete" | "ready";
export type FiscalDocumentStatus =
  | "pending"
  | "processing"
  | "authorized"
  | "manual_review"
  | "blocked"
  | "failed"
  | "cancel_requested"
  | "cancelled";

export type FiscalAuditEntry = {
  at: string;
  code: string;
  message: string;
  actorId?: string | null;
};

export type TenantFiscalConfig = {
  id: string;
  tenantId: string;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  onboardingStatus: FiscalOnboardingStatus;
  issuer: {
    legalName: string;
    cnpj: string;
    municipalRegistration: string;
    municipalCode: string;
    email?: string | null;
    phone?: string | null;
  };
  nfse: {
    serviceItemCode: string;
    municipalTaxCode?: string | null;
    taxRate: number;
    natureOperation?: string | null;
    simpleNational?: boolean;
    culturalIncentive?: boolean;
    specialTaxRegime?: string | null;
    withheldIss?: boolean;
  };
  focus: {
    companyReference?: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type FiscalServiceItemSnapshot = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type FiscalProposalSnapshot = {
  proposalId: string;
  tenantId: string;
  title: string;
  status: string;
  clientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  serviceItems: FiscalServiceItemSnapshot[];
  serviceTotal: number;
  hasProductItems: boolean;
  generatedAt: string;
};

export type FiscalDocument = {
  id: string;
  version: number;
  tenantId: string;
  proposalId: string;
  documentType: "nfse";
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  status: FiscalDocumentStatus;
  proposalTitle: string;
  serviceTotal: number;
  serviceItemsCount: number;
  hasProductItems: boolean;
  reasonCode?: string | null;
  reasonMessage?: string | null;
  providerReference: string;
  providerStatus?: string | null;
  providerMessage?: string | null;
  providerNumber?: string | null;
  pdfUrl?: string | null;
  xmlUrl?: string | null;
  cancellationXmlUrl?: string | null;
  attempts: number;
  lastError?: string | null;
  lastRequestedAt?: string | null;
  lastProcessedAt?: string | null;
  lockedUntil?: string | null;
  lockedBy?: string | null;
  payload?: Record<string, unknown> | null;
  providerResponse?: Record<string, unknown> | null;
  snapshot: FiscalProposalSnapshot;
  auditTrail: FiscalAuditEntry[];
  createdAt: string;
  updatedAt: string;
};

export type FiscalConfigReadiness = {
  ready: boolean;
  reasonCode?: string;
  reasonMessage?: string;
};
