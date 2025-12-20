/**
 * Get Plans Cloud Function
 *
 * Fetches plans from Stripe using configured Price IDs.
 * IMPORTANT: Prices come primarily from the IDs defined in stripeConfig.
 */

import * as functions from "firebase-functions";
import Stripe from "stripe";
import { getStripe, getPriceConfig } from "./stripeConfig";

// Default plans configuration - FALLBACK ONLY
const DEFAULT_PLANS = [
  {
    tier: "starter",
    name: "Starter",
    description: "Ideal para profissionais autônomos e pequenos negócios.",
    price: 0,
    pricing: { monthly: 0, yearly: 0 },
    order: 1,
    highlighted: false,
    features: {
      maxProposals: 30,
      maxClients: 30,
      maxProducts: 50,
      maxUsers: 2,
      hasFinancial: false,
      canCustomizeTheme: false,
      maxPdfTemplates: 1,
      canEditPdfSections: false,
      maxImagesPerProduct: 2,
      maxStorageMB: 200,
    },
  },
  {
    tier: "pro",
    name: "Pro",
    description: "Para equipes em crescimento que precisam de mais recursos.",
    price: 0,
    pricing: { monthly: 0, yearly: 0 },
    order: 2,
    highlighted: true,
    features: {
      maxProposals: 80,
      maxClients: 100,
      maxProducts: 200,
      maxUsers: 5,
      hasFinancial: true,
      canCustomizeTheme: true,
      maxPdfTemplates: 3,
      canEditPdfSections: false,
      maxImagesPerProduct: 5,
      maxStorageMB: 500,
    },
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    description: "Solução completa para grandes empresas.",
    price: 0,
    pricing: { monthly: 0, yearly: 0 },
    order: 3,
    highlighted: false,
    features: {
      maxProposals: -1,
      maxClients: -1,
      maxProducts: -1,
      maxUsers: -1,
      hasFinancial: true,
      canCustomizeTheme: true,
      maxPdfTemplates: -1,
      canEditPdfSections: true,
      maxImagesPerProduct: 10,
      maxStorageMB: 2000,
    },
  },
];

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

/**
 * Fetch plans from Stripe using configured Price IDs
 */
async function fetchPlansFromStripe(): Promise<Plan[]> {
  const stripe = getStripe();
  const config = getPriceConfig();

  try {
    // 2. Collect all configured Price IDs we care about
    const tierConfigMap: Record<
      string,
      { tier: string; monthlyId: string; yearlyId: string }
    > = {
      starter: {
        tier: "starter",
        monthlyId: config.plans.starter.monthly,
        yearlyId: config.plans.starter.yearly,
      },
      pro: {
        tier: "pro",
        monthlyId: config.plans.pro.monthly,
        yearlyId: config.plans.pro.yearly,
      },
      enterprise: {
        tier: "enterprise",
        monthlyId: config.plans.enterprise.monthly,
        yearlyId: config.plans.enterprise.yearly,
      },
    };

    const targetPriceIds = new Set<string>();
    Object.values(tierConfigMap).forEach((conf) => {
      if (conf.monthlyId) targetPriceIds.add(conf.monthlyId);
      if (conf.yearlyId) targetPriceIds.add(conf.yearlyId);
    });

    if (targetPriceIds.size === 0) {
      console.warn("No Price IDs configured in environment.");
      return [];
    }

    // 3. Fetch all active prices, expanding product data
    // We fetch list instead of individuals to minimize API calls (1 call vs N calls)
    const pricesResponse = await stripe.prices.list({
      active: true,
      limit: 100, // Should cover our needs
      expand: ["data.product"],
    });

    const relevantPrices = pricesResponse.data.filter((p) =>
      targetPriceIds.has(p.id)
    );

    const plans: Plan[] = [];

    // 4. Build Plan objects based on configured tiers
    for (const [key, conf] of Object.entries(tierConfigMap)) {
      if (!conf.monthlyId) continue;

      const monthlyPrice = relevantPrices.find((p) => p.id === conf.monthlyId);
      const yearlyPrice = relevantPrices.find((p) => p.id === conf.yearlyId);

      // If we can't find the monthly price (the base requirement), skip
      if (!monthlyPrice) {
        console.warn(
          `Configured monthly price ${conf.monthlyId} for ${key} not found in Stripe responses.`
        );
        continue;
      }

      const product = monthlyPrice.product as Stripe.Product;
      if (!product || typeof product === "string" || product.deleted) {
        console.warn(
          `Product not found or deleted for price ${monthlyPrice.id}`
        );
        continue;
      }

      // Default features (fallback)
      const defaultFeats =
        DEFAULT_PLANS.find((d) => d.tier === conf.tier)?.features ||
        DEFAULT_PLANS[0].features;

      // Extract metadata features (safe parsing)
      const meta = product.metadata || {};

      plans.push({
        id: product.id,
        name: product.name,
        tier: conf.tier,
        description: product.description || "",
        price: (monthlyPrice.unit_amount || 0) / 100,
        pricing: {
          monthly: (monthlyPrice.unit_amount || 0) / 100,
          yearly: yearlyPrice ? (yearlyPrice.unit_amount || 0) / 100 : 0,
        },
        order:
          parseInt(meta.order || "0") ||
          (key === "starter" ? 1 : key === "pro" ? 2 : 3),
        highlighted: meta.highlighted === "true",
        features: {
          maxProposals: meta.maxProposals
            ? parseInt(meta.maxProposals)
            : defaultFeats.maxProposals,
          maxClients: meta.maxClients
            ? parseInt(meta.maxClients)
            : defaultFeats.maxClients,
          maxProducts: meta.maxProducts
            ? parseInt(meta.maxProducts)
            : defaultFeats.maxProducts,
          maxUsers: meta.maxUsers
            ? parseInt(meta.maxUsers)
            : defaultFeats.maxUsers,
          hasFinancial: meta.hasFinancial
            ? meta.hasFinancial === "true"
            : defaultFeats.hasFinancial,
          canCustomizeTheme: meta.canCustomizeTheme
            ? meta.canCustomizeTheme === "true"
            : defaultFeats.canCustomizeTheme,
          maxPdfTemplates: meta.maxPdfTemplates
            ? parseInt(meta.maxPdfTemplates)
            : defaultFeats.maxPdfTemplates,
          canEditPdfSections: meta.canEditPdfSections
            ? meta.canEditPdfSections === "true"
            : defaultFeats.canEditPdfSections,
          maxImagesPerProduct: meta.maxImagesPerProduct
            ? parseInt(meta.maxImagesPerProduct)
            : defaultFeats.maxImagesPerProduct,
          maxStorageMB: meta.maxStorageMB
            ? parseInt(meta.maxStorageMB)
            : defaultFeats.maxStorageMB,
        },
        createdAt: new Date().toISOString(),
      });
    }

    return plans.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error("Error fetching plans from Stripe:", error);
    return [];
  }
}

/**
 * Public Cloud Function
 */
export const getPlans = functions
  .region("southamerica-east1")
  .https.onCall(async (): Promise<Plan[]> => {
    try {
      const stripePlans = await fetchPlansFromStripe();

      if (stripePlans.length > 0) {
        return stripePlans;
      }

      console.warn(
        "Returning default plans because Stripe fetch returned empty."
      );
      // Fallback
      return DEFAULT_PLANS.map((p) => ({
        ...p,
        id: p.tier,
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Error in getPlans:", error);
      return DEFAULT_PLANS.map((p) => ({
        ...p,
        id: p.tier,
        createdAt: new Date().toISOString(),
      }));
    }
  });
