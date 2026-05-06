/**
 * Stripe Configuration for Cloud Functions
 *
 * Centralized Stripe SDK initialization and configuration.
 * Uses Firebase Functions environment variables (v2 compatible).
 */

import Stripe from "stripe";
import { resolveFrontendAppUrl } from "../lib/frontend-app-url";

// Lazy initialization to avoid issues during deployment
let stripeInstance: Stripe | null = null;

/**
 * Get the Stripe instance (lazy initialization)
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not defined. " +
          "Set it via .env file or environment variables.",
      );
    }

    stripeInstance = new Stripe(secretKey, {
      // Use the latest stable API version
      apiVersion: "2024-11-20.acacia" as any,
      typescript: true,
    });
  }
  return stripeInstance;
}

/**
 * Get the Stripe webhook secret
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not defined. " +
        "Set it via .env file or environment variables.",
    );
  }

  return secret;
}

// Billing interval types
export type BillingInterval = "monthly" | "yearly";

// Price IDs configuration - loaded from environment
export interface StripePriceConfig {
  plans: Record<string, Record<BillingInterval, string>>;
  addons: Record<string, { monthly: string }>; // Addons only have monthly billing
}

/**
 * Get price configuration from environment
 */
export function getPriceConfig(): StripePriceConfig {
  return {
    plans: {
      starter: {
        monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || "",
        yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || "",
      },
      pro: {
        monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
        yearly: process.env.STRIPE_PRICE_PRO_YEARLY || "",
      },
      enterprise: {
        monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "",
        yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || "",
      },
    },
    addons: {
      financial: {
        monthly: process.env.STRIPE_ADDON_FINANCIAL_MONTHLY || "",
      },
      pdf_editor_partial: {
        monthly: process.env.STRIPE_ADDON_PDF_PARTIAL_MONTHLY || "",
      },
      pdf_editor_full: {
        monthly: process.env.STRIPE_ADDON_PDF_FULL_MONTHLY || "",
      },
      crm: {
        monthly: process.env.STRIPE_ADDON_CRM_MONTHLY || "",
      },
      whatsapp_overage: {
        monthly: "price_1T20T7GrkF9UfsqcEtdBX9fY",
      },
    },
  };
}

/**
 * Get price ID for a plan tier and billing interval
 */
export function getPriceIdForTier(
  tier: string,
  interval: BillingInterval = "monthly",
): string | null {
  const config = getPriceConfig();
  return config.plans[tier]?.[interval] || null;
}

/**
 * Get price ID for an add-on (always monthly)
 */
export function getPriceIdForAddon(addonType: string): string | null {
  const config = getPriceConfig();
  return config.addons[addonType]?.monthly || null;
}

/**
 * Get the app URL for redirects
 */
export function getAppUrl(): string {
  return resolveFrontendAppUrl();
}
