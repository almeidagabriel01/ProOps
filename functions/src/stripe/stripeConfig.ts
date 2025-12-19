/**
 * Stripe Configuration for Cloud Functions
 *
 * Centralized Stripe SDK initialization and configuration.
 * Uses Firebase Functions environment variables for secrets.
 */

import Stripe from "stripe";
import * as functions from "firebase-functions";

// Lazy initialization to avoid issues during deployment
let stripeInstance: Stripe | null = null;

/**
 * Get the Stripe instance (lazy initialization)
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey =
      process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key;

    if (!secretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not defined. " +
          'Set it via: firebase functions:config:set stripe.secret_key="sk_..."'
      );
    }

    stripeInstance = new Stripe(secretKey, {
      // Use the latest stable API version
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const secret =
    process.env.STRIPE_WEBHOOK_SECRET ||
    functions.config().stripe?.webhook_secret;

  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not defined. " +
        'Set it via: firebase functions:config:set stripe.webhook_secret="whsec_..."'
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
  const config = functions.config().stripe || {};

  return {
    plans: {
      starter: {
        monthly:
          config.price_starter_monthly ||
          process.env.STRIPE_PRICE_STARTER_MONTHLY ||
          "",
        yearly:
          config.price_starter_yearly ||
          process.env.STRIPE_PRICE_STARTER_YEARLY ||
          "",
      },
      pro: {
        monthly:
          config.price_pro_monthly ||
          process.env.STRIPE_PRICE_PRO_MONTHLY ||
          "",
        yearly:
          config.price_pro_yearly || process.env.STRIPE_PRICE_PRO_YEARLY || "",
      },
      enterprise: {
        monthly:
          config.price_enterprise_monthly ||
          process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY ||
          "",
        yearly:
          config.price_enterprise_yearly ||
          process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ||
          "",
      },
    },
    addons: {
      financial: {
        monthly:
          config.addon_financial_monthly ||
          process.env.STRIPE_ADDON_FINANCIAL_MONTHLY ||
          "",
      },
      pdf_editor_partial: {
        monthly:
          config.addon_pdf_partial_monthly ||
          process.env.STRIPE_ADDON_PDF_PARTIAL_MONTHLY ||
          "",
      },
      pdf_editor_full: {
        monthly:
          config.addon_pdf_full_monthly ||
          process.env.STRIPE_ADDON_PDF_FULL_MONTHLY ||
          "",
      },
    },
  };
}

/**
 * Get price ID for a plan tier and billing interval
 */
export function getPriceIdForTier(
  tier: string,
  interval: BillingInterval = "monthly"
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
  return (
    process.env.APP_URL ||
    functions.config().app?.url ||
    "http://localhost:3000"
  );
}
