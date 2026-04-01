/**
 * Stripe Cloud Functions Service
 *
 * Client-side wrapper for calling Stripe API.
 * Refactored to use REST API instead of httpsCallable.
 */

import { callApi, callPublicApi } from "@/lib/api-client";

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
  skipTrial?: boolean;
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
  subscriptionId?: string;
  planTier?: string;
  status?: string;
  trial?: boolean;
  trialEndsAt?: string;
}

interface AddonCheckoutRequest {
  userId: string;
  addonId: string;
  origin?: string;
}

interface AddonCheckoutResponse {
  url?: string;
  success?: boolean;
  message?: string;
}

interface AddonConfirmRequest {
  sessionId: string;
}

interface AddonConfirmResponse {
  success: boolean;
  subscriptionId?: string;
  addonType?: string;
}

interface PortalRequest {
  userId: string;
  origin?: string;
}

interface PortalResponse {
  url: string;
}

interface UpdateRequest {
  subscriptionId: string;
  newPriceId: string;
}

interface UpdateResponse {
  success: boolean;
  message: string;
}

interface PreviewRequest {
  subscriptionId?: string;
  newPriceId?: string;
  newPlanTier?: string; // Added to match usage
  billingInterval?: string; // Added to match usage
  proration?: boolean;
  userId?: string;
}

interface PreviewResponse {
  amountDue: number;
  currency: string;
  preview?: Record<string, unknown>;
  isNewSubscription?: boolean;
}

export interface PriceInfo {
  id: string;
  amount: number; // in cents
  currency: string;
  interval: "monthly" | "yearly";
  productId: string;
  productName?: string;
}

export interface PriceSet {
  monthly: PriceInfo | null;
  yearly: PriceInfo | null;
}

export interface PricesResponse {
  plans: Record<string, PriceSet>;
  addons: Record<string, PriceSet>;
}

interface Plan {
  id: string;
  name: string;
}

interface CancelAddonRequest {
  subscriptionId?: string;
  subscriptionItemId?: string;
  addonId?: string;
  addonType?: string;
}

interface SyncResponse {
  success: boolean;
  data: {
    status: string;
    currentPeriodEnd: string;
  };
}

interface SyncAllRequest {
  dryRun?: boolean;
  limit?: number;
  startAfterId?: string;
}

interface SyncAllResponse {
  success: boolean;
  dryRun: boolean;
  scanned: number;
  eligible: number;
  synced: number;
  failed: number;
  nextStartAfterId: string | null;
  hasMore: boolean;
  errors: Array<{ userId: string; error: string }>;
}

// ============================================
// SERVICE
// ============================================

export const StripeService = {
  createCheckoutSession: async (
    data: CheckoutRequest,
  ): Promise<CheckoutResponse> => {
    try {
      const response = await callApi<CheckoutResponse>(
        "/v1/stripe/checkout",
        "POST",
        data,
      );
      return response;
    } catch (error) {
      console.error("Error creating checkout session:", error);
      throw error;
    }
  },

  confirmCheckout: async (
    data: ConfirmRequest,
  ): Promise<ConfirmResponse> => {
    return callApi<ConfirmResponse>(
      "/v1/stripe/confirm-checkout",
      "POST",
      data,
    );
  },

  createAddonCheckout: async (
    data: AddonCheckoutRequest,
  ): Promise<AddonCheckoutResponse> => {
    return StripeService.createAddonCheckoutSession(data);
  },

  createAddonCheckoutSession: async (
    data: AddonCheckoutRequest,
  ): Promise<AddonCheckoutResponse> => {
    try {
      const response = await callApi<AddonCheckoutResponse>(
        "/v1/stripe/checkout-addon",
        "POST",
        data,
      );
      return response;
    } catch (error) {
      console.error("Error creating addon checkout session:", error);
      throw error;
    }
  },

  confirmAddonCheckout: async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _data: AddonConfirmRequest,
  ): Promise<AddonConfirmResponse> => {
    return { success: true };
  },

  cancelAddon: async (data: CancelAddonRequest): Promise<void> => {
    // If we have subscriptionId/Item, use standard cancel
    if (data.subscriptionId || data.subscriptionItemId) {
      // Fallback or specific logic
    }
    await callApi("/v1/stripe/cancel", "POST", data);
  },

  cancelSubscription: async (): Promise<{
    success: boolean;
    cancelAt?: string;
  }> => {
    return callApi("/v1/stripe/cancel-subscription", "POST", {});
  },

  createPortalSession: async (data: PortalRequest): Promise<PortalResponse> => {
    try {
      const response = await callApi<PortalResponse>(
        "/v1/stripe/portal",
        "POST",
        data,
      );
      return response;
    } catch (error) {
      console.error("Error creating portal session:", error);
      throw error;
    }
  },

  syncSubscription: async (): Promise<SyncResponse> => {
    try {
      const response = await callApi<SyncResponse>(
        "/v1/stripe/sync",
        "POST",
        {},
      );
      return response;
    } catch (error) {
      console.error("Error syncing subscription:", error);
      throw error;
    }
  },

  syncAllSubscriptions: async (
    data: SyncAllRequest,
  ): Promise<SyncAllResponse> => {
    try {
      const response = await callApi<SyncAllResponse>(
        "/v1/stripe/sync-all",
        "POST",
        data,
      );
      return response;
    } catch (error) {
      console.error("Error syncing all subscriptions:", error);
      throw error;
    }
  },

  updateSubscription: async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _data: UpdateRequest,
  ): Promise<UpdateResponse> => {
    return { success: true, message: "Use portal" };
  },

  previewProration: async (
    data: PreviewRequest,
  ): Promise<PreviewResponse> => {
    return callApi<PreviewResponse>("/v1/stripe/preview", "POST", data);
  },

  getPrices: async (): Promise<PricesResponse> => {
    // Define internal types matching the actual Backend Response
    type BackendPlan = {
      tier: string;
      pricing: { monthly: number; yearly: number };
    };

    type BackendResponse = {
      plans: BackendPlan[];
      addons: Record<string, { monthly: { amount: number } }>;
    };

    const result = await callPublicApi<
      BackendResponse | { data: BackendResponse }
    >("/v1/stripe/plans", "GET", undefined, { cache: "no-store" });

    // Handle both direct response and { data: ... } wrapper
    const data = "data" in result ? result.data : result;

    // Transform Plans Array -> Record<string, PriceSet>
    const plansRecord: Record<string, PriceSet> = {};

    if (Array.isArray(data.plans)) {
      data.plans.forEach((plan) => {
        plansRecord[plan.tier] = {
          monthly: {
            id: `price_${plan.tier}_monthly`, // Dummy ID, we only need amount for display
            amount: plan.pricing.monthly * 100, // Convert Unit -> Cents
            currency: "brl",
            interval: "monthly",
            productId: `prod_${plan.tier}`,
          },
          yearly: {
            id: `price_${plan.tier}_yearly`,
            amount: plan.pricing.yearly * 100, // Convert Unit -> Cents
            currency: "brl",
            interval: "yearly",
            productId: `prod_${plan.tier}`,
          },
        };
      });
    }

    // Transform Addons (if needed, or pass through if structure matches enough)
    // Backend addons: Record<string, { monthly: { amount: number } }>
    // Frontend addons: Record<string, PriceSet>
    const addonsRecord: Record<string, PriceSet> = {};
    if (data.addons) {
      Object.entries(data.addons).forEach(([key, value]) => {
        addonsRecord[key] = {
          monthly: {
            id: `price_addon_${key}`,
            amount: value.monthly.amount * 100, // Backend sends unit or cents?
            // Controller line 508: addons[addonType] = { monthly: { amount } };
            // amount comes from priceMap which is units (line 462).
            // So we multiply by 100.
            currency: "brl",
            interval: "monthly",
            productId: `prod_addon_${key}`,
          },
          yearly: null,
        };
      });
    }

    return {
      plans: plansRecord,
      addons: addonsRecord,
    };
  },

  getPlans: async (): Promise<Plan[]> => {
    const result = await callPublicApi<{ plans: Record<string, unknown>[] }>(
      "/v1/stripe/plans",
      "GET",
      undefined,
      { cache: "no-store" }, // Ensure no cache here as well
    );
    return (result.plans || []) as unknown as Plan[];
  },

  // Aliases for compatibility
  createCheckout: async (data: CheckoutRequest): Promise<CheckoutResponse> => {
    return StripeService.createCheckoutSession(data);
  },

  getPreview: async (data: PreviewRequest): Promise<PreviewResponse> => {
    return StripeService.previewProration(data);
  },
};
