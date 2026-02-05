// Nichos disponíveis no sistema
export type TenantNiche = "automacao_residencial" | "varejo";

export const NICHE_LABELS: Record<TenantNiche, string> = {
  automacao_residencial: "Automação Residencial",
  varejo: "Varejo",
};

export type Tenant = {
  id: string;
  name: string;
  slug?: string;
  primaryColor?: string; // Hex code
  logoUrl?: string;
  niche: TenantNiche;
  createdAt?: string;
  proposalDefaults?: Record<string, unknown>;
};

export type User = {
  id: string;
  tenantId?: string; // Optional for free users
  name: string;
  email: string;
  photoURL?: string;
  password?: string; // Kept for types compatibility, but Firebase Auth handles passwords
  role: "admin" | "user" | "superadmin" | "free" | "member";
  planId?: string; // Reference to user's subscription plan
  billingInterval?: BillingInterval; // 'monthly' | 'yearly'
  stripeCustomerId?: string; // Stripe customer ID
  stripeSubscriptionId?: string; // Active Stripe subscription ID
  masterId?: string; // ID of the master account if this is a sub-user
  permissions?: Record<
    string,
    {
      canView?: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canDelete?: boolean;
    }
  >;
  planUpdatedAt?: string; // Last plan change date

  // Manual Subscription Fields
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string; // ISO Date string for expiration
  isManualSubscription?: boolean; // If true, handled by internal cron, not Stripe
  cancelAtPeriodEnd?: boolean;
  subscription?: {
    status: string;
    updatedAt?: string | Date;
  };
  subscriptionUpdatedAt?: string;
};

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "trialing"
  | "free"
  | "inactive"
  | "trial";

// Subscription Plans
export type PlanTier = "starter" | "pro" | "enterprise";

export type BillingInterval = "monthly" | "yearly";

export type PlanPricing = {
  monthly: number; // Preço mensal
  yearly: number; // Preço anual total
};

export type PlanFeatures = {
  maxProposals: number; // -1 for unlimited, per month
  maxClients: number; // -1 for unlimited
  maxProducts: number; // -1 for unlimited
  maxUsers: number; // -1 for unlimited
  hasFinancial: boolean; // Access to financial module
  canCustomizeTheme: boolean; // Can change colors/branding
  maxPdfTemplates: number; // Number of PDF templates available (-1 = all)
  canEditPdfSections: boolean; // Can edit PDF sections (Enterprise only)
  maxImagesPerProduct: number; // Max images per product (2-3)
  maxStorageMB: number; // Total storage in MB (-1 = unlimited)
};

export type UserPlan = {
  id: string;
  name: string;
  tier: PlanTier;
  description: string;
  price: number; // Monthly price in BRL (for compatibility)
  pricing?: PlanPricing; // Multi-interval pricing
  features: PlanFeatures;
  order: number; // For sorting/hierarchy (1 = lowest, 3 = highest)
  highlighted?: boolean; // To highlight a recommended plan
  stripePriceId?: string; // Legacy: Stripe Price ID for checkout
  createdAt: string;
};

// Add-on Module Types
export type AddonType =
  | "financial"
  | "pdf_editor_partial" // 3 templates, no content editing
  | "pdf_editor_full"; // Full access: all templates + content editing

export type PurchasedAddon = {
  id: string;
  tenantId: string;
  addonType: AddonType;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  status: "active" | "cancelled" | "past_due";
  billingInterval?: "monthly" | "yearly"; // Track billing interval for upgrade options
  quantity?: number; // For quantitative add-ons (e.g., extra users)
  purchasedAt: string;
  expiresAt?: string;
  currentPeriodEnd?: string; // For grace period calculation
  cancelAtPeriodEnd?: boolean; // Whether cancellation is scheduled
};

export type AddonDefinition = {
  id: AddonType;
  name: string;
  description: string;
  featureKey: keyof PlanFeatures | "extraUsers";
  featureValue: boolean | number; // Value to apply when active
  // IMPORTANT: Prices are NOT stored here - they come ONLY from Stripe via Cloud Functions
  // This ensures proper separation between dev/staging/production environments
  icon: string; // Lucide icon name
  order: number; // For sorting display
  availableForTiers: PlanTier[]; // Which plans can purchase this
};

// Proposals
export type ProposalSectionType =
  | "text"
  | "table"
  | "image"
  | "list"
  | "separator"
  | "header"
  | "custom-field"
  | "hierarchical-field"
  | "product-table";

export type TextStyle = {
  color?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right" | "justify";
  textDecoration?: "none" | "underline";
};

export type ImageStyle = {
  width?: number; // Percentage 25-100
  align?: "left" | "center" | "right";
  borderRadius?: number;
  shadow?: boolean;
  margin?: "small" | "medium" | "large";
};

export type ProposalSection = {
  id: string;
  type: ProposalSectionType;
  title: string;
  content: string; // JSON stringified content based on type
  order: number;
  textStyle?: TextStyle;
  imageStyle?: ImageStyle;
};

export type ProposalTableItem = {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type ProposalStatus =
  | "draft"
  | "in_progress"
  | "sent"
  | "approved"
  | "rejected";

/* 
   We have partial duplication of Proposal/Product types in services. 
   Ideally, we should consolidate, but for now we keep the MockDB structure 
   as the "frontend" type and service types should eventually align.
*/

// Custom Fields
export type CustomFieldItem = {
  id: string;
  label: string;
  value: string; // Used for option value
  order: number;
  isDefault?: boolean;
  image?: string; // Base64 encoded image
  description?: string;
  parentItemIds?: string[]; // For linked fields: which parent items this belongs to
};

export type CustomFieldType = {
  id: string;
  tenantId: string;
  name: string; // "Ambiente", "Sistema"
  description?: string;
  parentTypeId?: string; // For linked fields: if set, this field depends on another
  items: CustomFieldItem[];
  createdAt?: string;
};

// Proposal Template
export type ProposalTemplate = {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  introductionText: string; // "Prezado cliente, temos o prazer..."
  scopeText: string; // "O escopo deste projeto inclui..."
  paymentTerms: string; // "Condições de pagamento..."
  warrantyText: string; // "Garantia de X meses..."
  footerText: string; // "Atenciosamente, Equipe..."
  coverImage?: string; // Base64 cover image
  theme: "modern" | "classic" | "minimal" | "tech" | "elegant" | "bold";
  primaryColor: string;
  fontFamily: string;
  repeatHeader?: boolean;
};

// PDF Settings match ProposalService structure
export type ProposalPdfSettings = {
  primaryColor: string;
  secondaryColor?: string;
  fontFamily: string;
  includeLogo: boolean;
  includeHeader: boolean;
  includeFooter: boolean;
  margins: "normal" | "narrow" | "wide";
  logoStyle?: "original" | "rounded" | "circle";
};

// ============================================
// WALLET TYPES
// ============================================

export type WalletType = "bank" | "cash" | "digital" | "credit_card" | "other";

export type Wallet = {
  id: string;
  tenantId: string;
  name: string; // "NuBank", "Caixa", "PicPay", etc.
  type: WalletType;
  balance: number; // Current balance in BRL (stored as number, e.g., 150.50)
  color: string; // Hex color for UI
  icon?: string; // Optional Lucide icon name
  description?: string;
  isDefault?: boolean; // Default wallet for new transactions
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type WalletTransactionType =
  | "deposit" // Add money to wallet
  | "withdrawal" // Remove money from wallet
  | "transfer_in" // Received from another wallet
  | "transfer_out" // Sent to another wallet
  | "adjustment"; // Manual balance adjustment

export type WalletTransaction = {
  id: string;
  tenantId: string;
  walletId: string;
  type: WalletTransactionType;
  amount: number; // Always positive, type determines direction
  description: string;
  relatedWalletId?: string; // For transfers: the other wallet
  relatedTransactionId?: string; // Link to financial transaction if applicable
  balanceAfter: number; // Wallet balance after this transaction
  createdAt: string;
  createdBy: string; // User ID who performed the action
};

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  bank: "Conta Bancária",
  cash: "Dinheiro",
  digital: "Carteira Digital",
  credit_card: "Cartão de Crédito",
  other: "Outro",
};

export const WALLET_TYPE_ICONS: Record<WalletType, string> = {
  bank: "Building2",
  cash: "Banknote",
  digital: "Smartphone",
  credit_card: "CreditCard",
  other: "Wallet",
};

// Re-export PDF display settings
export {
  type PdfDisplaySettings,
  defaultPdfDisplaySettings,
  mergePdfDisplaySettings,
} from "./pdf-display-settings";

// ============================================
// SPREADSHEET TYPES
// ============================================

export type CellStyle = {
  v?: string | number | boolean | null;
  m?: string;
  bg?: string;
  fc?: string;
  bl?: number;
  it?: number;
  fs?: number;
  cl?: number;
  ht?: number;
  vt?: number;
  // Add other known FortuneSheet cell properties as needed
  [key: string]: unknown;
};

export type RowData = (CellStyle | null)[];

export type SheetData = {
  name: string;
  id?: string;
  color?: string;
  status?: number;
  order?: number;
  hide?: number;
  row?: number;
  column?: number;
  celldata?: unknown[]; // FortuneSheet specific compressed data
  data?: RowData[]; // Expanded 2D array data
  config?: Record<string, unknown>;
  index?: number;
  zoomRatio?: number;
  scrollTop?: number;
  scrollLeft?: number;
  [key: string]: unknown;
};

export interface WorkbookInstance {
  getCellValue: (r: number, c: number) => CellStyle | string | number | null;
  getAllSheets: () => SheetData[];
  // Add other methods used from the ref
}
