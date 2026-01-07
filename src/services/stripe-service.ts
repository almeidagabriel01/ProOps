/**
 * Stripe Cloud Functions Service
 *
 * Client-side wrapper for calling Stripe API.
 * Refactored to use REST API instead of httpsCallable.
 */

import { callApi } from "@/lib/api-client";

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
  subscriptionId?: string;
  planTier?: string;
}

interface AddonCheckoutRequest {
  userId: string;
  addonId: string;
  origin?: string;
  tenantId?: string; // Added to match usage
}

interface AddonCheckoutResponse {
  url?: string;
  success?: boolean;
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

interface PricesResponse {
  plans: unknown;
  addons: unknown;
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
  tenantId?: string;
}

interface SyncResponse {
  success: boolean;
  data: {
    status: string;
    currentPeriodEnd: string;
  };
}

// ============================================
// SERVICE
// ============================================

export const StripeService = {
  createCheckoutSession: async (
    data: CheckoutRequest
  ): Promise<CheckoutResponse> => {
    try {
      const response = await callApi<CheckoutResponse>(
        "/v1/stripe/checkout",
        "POST",
        data
      );
      return response;
    } catch (error) {
      console.error("Error creating checkout session:", error);
      throw error;
    }
  },

  confirmCheckout: async (_data: ConfirmRequest): Promise<ConfirmResponse> => {
    // NOTE: Checkout confirmation usually happens via Webhook or just on success page.
    return { success: true };
  },

  createAddonCheckout: async (
    data: AddonCheckoutRequest
  ): Promise<AddonCheckoutResponse> => {
    return StripeService.createAddonCheckoutSession(data);
  },

  createAddonCheckoutSession: async (
    data: AddonCheckoutRequest
  ): Promise<AddonCheckoutResponse> => {
    try {
      const response = await callApi<AddonCheckoutResponse>(
        "/v1/stripe/checkout-addon",
        "POST",
        data
      );
      return response;
    } catch (error) {
      console.error("Error creating addon checkout session:", error);
      throw error;
    }
  },

  confirmAddonCheckout: async (
    _data: AddonConfirmRequest
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
        data
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
        {}
      );
      return response;
    } catch (error) {
      console.error("Error syncing subscription:", error);
      throw error;
    }
  },

  updateSubscription: async (_data: UpdateRequest): Promise<UpdateResponse> => {
    return { success: true, message: "Use portal" };
  },

  previewProration: async (_data: PreviewRequest): Promise<PreviewResponse> => {
    return { amountDue: 0, currency: "brl" };
  },

  getPrices: async (): Promise<PricesResponse> => {
    const result = await callApi<{ data: PricesResponse }>(
      "/v1/stripe/plans",
      "GET"
    );
    const data = result.data || result;
    return {
      plans: (data as PricesResponse).plans,
      addons: (data as PricesResponse).addons,
    };
  },

  getPlans: async (): Promise<Plan[]> => {
    const result = await callApi<{ plans: Plan[] }>("/v1/stripe/plans", "GET");
    return result.plans || [];
  },

  // Aliases for compatibility
  createCheckout: async (data: CheckoutRequest): Promise<CheckoutResponse> => {
    return StripeService.createCheckoutSession(data);
  },

  getPreview: async (data: PreviewRequest): Promise<PreviewResponse> => {
    return StripeService.previewProration(data);
  },
};
