/**
 * Stripe Cloud Functions Service
 *
 * Client-side wrapper for calling Stripe Cloud Functions.
 * Replaces direct API route calls with httpsCallable.
 */

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

// ============================================
// TYPES
// ============================================

export type BillingInterval = "monthly" | "yearly";

interface CheckoutRequest {
  userId: string;
  planTier: string;
  userEmail?: string;
  billingInterval?: BillingInterval;
  origin?: string;
}

interface CheckoutResponse {
  url?: string;
  success?: boolean;
  message?: string;
}

interface ConfirmRequest {
  sessionId: string;
}

interface ConfirmResponse {
  success: boolean;
  planId?: string;
  planTier?: string;
}

interface AddonCheckoutRequest {
  userId: string;
  tenantId: string;
  addonType: string;
  userEmail?: string;
  billingInterval?: BillingInterval;
  origin?: string;
}

interface AddonCheckoutResponse {
  url?: string;
}

interface AddonConfirmRequest {
  sessionId: string;
}

interface AddonConfirmResponse {
  success: boolean;
  addonId?: string;
  addonType?: string;
  tenantId?: string;
}

interface PortalRequest {
  userId: string;
  origin?: string;
}

interface PortalResponse {
  url?: string;
}

interface UpdateRequest {
  userId: string;
  planTier: string;
}

interface UpdateResponse {
  success: boolean;
  message?: string;
}

interface PlanPreview {
  tier: string;
  price: number;
  interval: BillingInterval;
}

interface PaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface PreviewData {
  currentPlan: PlanPreview;
  newPlan: PlanPreview;
  amountDue: number;
  creditAmount: number;
  isUpgrade: boolean;
  isDowngrade: boolean;
  paymentMethod: PaymentMethod | null;
  nextBillingDate: string;
}

interface PreviewRequest {
  userId: string;
  newPlanTier: string;
  billingInterval?: BillingInterval;
}

interface PreviewResponse {
  preview: PreviewData | null;
  message?: string;
  isNewSubscription?: boolean;
}

interface PriceInfo {
  id: string;
  amount: number;
  currency: string;
  interval: BillingInterval;
  productId: string;
  productName?: string;
}

interface PricesResponse {
  plans: Record<
    string,
    { monthly: PriceInfo | null; yearly: PriceInfo | null }
  >;
  addons: Record<
    string,
    { monthly: PriceInfo | null; yearly: PriceInfo | null }
  >;
  cached?: boolean;
  cacheAge?: number;
  stale?: boolean;
}

interface PlanFeatures {
  maxProposals: number;
  maxClients: number;
  maxProducts: number;
  maxUsers: number;
  hasFinancial: boolean;
  canCustomizeTheme: boolean;
  maxPdfTemplates: number;
  canEditPdfSections: boolean;
  maxImagesPerProduct: number;
  maxStorageMB: number;
}

interface Plan {
  id: string;
  tier: string;
  name: string;
  description: string;
  price: number;
  pricing: { monthly: number; yearly: number };
  order: number;
  highlighted: boolean;
  features: PlanFeatures;
  createdAt: string;
}

// ============================================
// SERVICE
// ============================================

export const StripeService = {
  /**
   * Create a checkout session for plan subscription
   */
  async createCheckout(data: CheckoutRequest): Promise<CheckoutResponse> {
    const fn = httpsCallable<CheckoutRequest, CheckoutResponse>(
      functions,
      "stripeCheckout"
    );
    const result = await fn(data);
    return result.data;
  },

  /**
   * Confirm checkout after successful payment
   */
  async confirmCheckout(data: ConfirmRequest): Promise<ConfirmResponse> {
    const fn = httpsCallable<ConfirmRequest, ConfirmResponse>(
      functions,
      "stripeConfirm"
    );
    const result = await fn(data);
    return result.data;
  },

  /**
   * Create a checkout session for add-on subscription
   */
  async createAddonCheckout(
    data: AddonCheckoutRequest
  ): Promise<AddonCheckoutResponse> {
    const fn = httpsCallable<AddonCheckoutRequest, AddonCheckoutResponse>(
      functions,
      "stripeAddonCheckout"
    );
    const result = await fn(data);
    return result.data;
  },

  /**
   * Confirm add-on checkout after successful payment
   */
  async confirmAddonCheckout(
    data: AddonConfirmRequest
  ): Promise<AddonConfirmResponse> {
    const fn = httpsCallable<AddonConfirmRequest, AddonConfirmResponse>(
      functions,
      "stripeAddonConfirm"
    );
    const result = await fn(data);
    return result.data;
  },

  /**
   * Create a Customer Portal session
   */
  async createPortalSession(data: PortalRequest): Promise<PortalResponse> {
    const fn = httpsCallable<PortalRequest, PortalResponse>(
      functions,
      "stripePortal"
    );
    const result = await fn(data);
    return result.data;
  },

  /**
   * Update existing subscription
   */
  async updateSubscription(data: UpdateRequest): Promise<UpdateResponse> {
    const fn = httpsCallable<UpdateRequest, UpdateResponse>(
      functions,
      "stripeUpdate"
    );
    const result = await fn(data);
    return result.data;
  },

  /**
   * Get proration preview before plan change
   */
  async getPreview(data: PreviewRequest): Promise<PreviewResponse> {
    const fn = httpsCallable<PreviewRequest, PreviewResponse>(
      functions,
      "stripePreview"
    );
    const result = await fn(data);
    return result.data;
  },

  /**
   * Get prices from Stripe (with caching)
   */
  async getPrices(): Promise<PricesResponse> {
    const fn = httpsCallable<void, PricesResponse>(functions, "stripePrices");
    const result = await fn();
    return result.data;
  },

  /**
   * Force refresh prices cache
   */
  async refreshPrices(): Promise<PricesResponse> {
    const fn = httpsCallable<void, PricesResponse>(
      functions,
      "stripePricesRefresh"
    );
    const result = await fn();
    return result.data;
  },

  /**
   * Get plans from Stripe (merged with defaults)
   */
  async getPlans(): Promise<Plan[]> {
    const fn = httpsCallable<void, Plan[]>(functions, "getPlans");
    const result = await fn();
    return result.data;
  },
};
