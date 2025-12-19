// Nichos disponíveis no sistema
export type TenantNiche = "automacao_residencial" | "varejo";

export const NICHE_LABELS: Record<TenantNiche, string> = {
  automacao_residencial: "Automação Residencial",
  varejo: "Varejo",
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string; // Hex code
  logoUrl?: string;
  niche: TenantNiche;
  createdAt: string;
};

export type User = {
  id: string;
  tenantId?: string; // Optional for free users
  name: string;
  email: string;
  password?: string; // Kept for types compatibility, but Firebase Auth handles passwords
  role: "admin" | "user" | "superadmin" | "free";
  planId?: string; // Reference to user's subscription plan
  billingInterval?: BillingInterval; // 'monthly' | 'yearly'
  stripeCustomerId?: string; // Stripe customer ID
  stripeSubscriptionId?: string; // Active Stripe subscription ID
  planUpdatedAt?: string; // Last plan change date
};

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

export type ProposalStatus = "draft" | "sent" | "approved" | "rejected";

/* 
   We have partial duplication of Proposal/Product types in services. 
   Ideally, we should consolidate, but for now we keep the MockDB structure 
   as the "frontend" type and service types should eventually align.
*/

// Custom Fields
export type CustomFieldItem = {
  id: string;
  label: string;
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
  createdAt: string;
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
};
