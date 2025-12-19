/**
 * Get Plans Cloud Function
 *
 * Fetches plans from Stripe and merges with defaults.
 * IMPORTANT: Prices come from Stripe API, not from DEFAULT_PLANS
 * Migrated from: src/app/api/plans/route.ts + src/lib/stripe-sync.ts
 */

import * as functions from "firebase-functions";
import { getStripe } from "./stripeConfig";

// Default plans configuration - FALLBACK ONLY
// These values are used only when Stripe API is unavailable
// In production, prices are always fetched from Stripe
const DEFAULT_PLANS = [
  {
    tier: "starter",
    name: "Starter",
    description: "Ideal para profissionais autônomos e pequenos negócios.",
    price: 49,
    pricing: { monthly: 49, yearly: 490 },
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
    price: 99,
    pricing: { monthly: 99, yearly: 990 },
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
    price: 199,
    pricing: { monthly: 199, yearly: 1990 },
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
 * Fetch plans from Stripe
 */
async function fetchPlansFromStripe(): Promise<Plan[]> {
  const stripe = getStripe();

  try {
    // Fetch active products
    const products = await stripe.products.list({
      active: true,
      expand: ["data.default_price"],
    });

    // Fetch active prices
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });

    const tierOrder: Record<string, number> = {
      starter: 1,
      pro: 2,
      enterprise: 3,
    };

    const plans: Plan[] = [];

    for (const product of products.data) {
      const tier = product.metadata.tier || product.name.toLowerCase();

      // Only include main plan tiers
      if (!["starter", "pro", "enterprise"].includes(tier)) continue;

      const productPrices = prices.data.filter((p) => p.product === product.id);

      const monthlyPrice = productPrices.find(
        (p) => p.recurring?.interval === "month"
      );
      const yearlyPrice = productPrices.find(
        (p) => p.recurring?.interval === "year"
      );

      if (!monthlyPrice) continue;

      plans.push({
        id: product.id,
        name: product.name,
        tier: tier as "starter" | "pro" | "enterprise",
        description: product.description || "",
        price: (monthlyPrice.unit_amount || 0) / 100,
        pricing: {
          monthly: (monthlyPrice.unit_amount || 0) / 100,
          yearly: (yearlyPrice?.unit_amount || 0) / 100,
        },
        order: parseInt(product.metadata.order || "0") || tierOrder[tier] || 99,
        highlighted: product.metadata.highlighted === "true",
        features: {
          maxProposals: parseInt(product.metadata.maxProposals || "0"),
          maxClients: parseInt(product.metadata.maxClients || "0"),
          maxProducts: parseInt(product.metadata.maxProducts || "0"),
          maxUsers: parseInt(product.metadata.maxUsers || "0"),
          hasFinancial: product.metadata.hasFinancial === "true",
          canCustomizeTheme: product.metadata.canCustomizeTheme === "true",
          maxPdfTemplates: parseInt(product.metadata.maxPdfTemplates || "1"),
          canEditPdfSections: product.metadata.canEditPdfSections === "true",
          maxImagesPerProduct: parseInt(
            product.metadata.maxImagesPerProduct || "2"
          ),
          maxStorageMB: parseInt(product.metadata.maxStorageMB || "200"),
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
 * Merge Stripe plans with defaults
 */
function mergePlans(stripePlans: Plan[]): Plan[] {
  return stripePlans.map((stripePlan) => {
    const defaultPlan = DEFAULT_PLANS.find((p) => p.tier === stripePlan.tier);

    if (!defaultPlan) return stripePlan;

    // Use default features as base, override with Stripe values if present
    const mergedFeatures: PlanFeatures = { ...defaultPlan.features };

    if (stripePlan.features) {
      const sf = stripePlan.features;
      if (sf.maxProposals !== 0) mergedFeatures.maxProposals = sf.maxProposals;
      if (sf.maxClients !== 0) mergedFeatures.maxClients = sf.maxClients;
      if (sf.maxProducts !== 0) mergedFeatures.maxProducts = sf.maxProducts;
      if (sf.maxUsers !== 0) mergedFeatures.maxUsers = sf.maxUsers;
      if (sf.hasFinancial) mergedFeatures.hasFinancial = sf.hasFinancial;
      if (sf.canCustomizeTheme) {
        mergedFeatures.canCustomizeTheme = sf.canCustomizeTheme;
      }
      if (sf.maxPdfTemplates !== 1) {
        mergedFeatures.maxPdfTemplates = sf.maxPdfTemplates;
      }
      if (sf.canEditPdfSections) {
        mergedFeatures.canEditPdfSections = sf.canEditPdfSections;
      }
      if (sf.maxImagesPerProduct !== 2) {
        mergedFeatures.maxImagesPerProduct = sf.maxImagesPerProduct;
      }
      if (sf.maxStorageMB !== 200) {
        mergedFeatures.maxStorageMB = sf.maxStorageMB;
      }
    }

    return {
      ...defaultPlan,
      ...stripePlan,
      features: mergedFeatures,
      description: stripePlan.description || defaultPlan.description,
    };
  });
}

export const getPlans = functions
  .region("southamerica-east1")
  .https.onCall(async (): Promise<Plan[]> => {
    try {
      // Try to fetch from Stripe first
      const stripePlans = await fetchPlansFromStripe();

      if (stripePlans.length > 0) {
        return mergePlans(stripePlans);
      }

      // Fallback to defaults
      return DEFAULT_PLANS.map((p) => ({
        ...p,
        id: p.tier,
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Error in getPlans:", error);
      // Fallback on error
      return DEFAULT_PLANS.map((p) => ({
        ...p,
        id: p.tier,
        createdAt: new Date().toISOString(),
      }));
    }
  });
