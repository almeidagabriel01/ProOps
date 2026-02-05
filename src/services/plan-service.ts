import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { UserPlan } from "@/types";

const COLLECTION_NAME = "plans";

// Default plans - FALLBACK ONLY when Stripe is unavailable
// IMPORTANT: In production, prices come from Stripe via StripeService.getPlans()
// These values are only used as a last resort if Stripe API fails
export const DEFAULT_PLANS: Omit<UserPlan, "id">[] = [
  {
    name: "Starter",
    tier: "starter",
    description: "Ideal para freelancers e pequenos negócios",
    price: 0,
    pricing: {
      monthly: 0,
      yearly: 0,
    },
    order: 1,
    features: {
      maxProposals: 80,
      maxClients: 120,
      maxProducts: 220,
      maxUsers: 2,
      hasFinancial: false,
      canCustomizeTheme: false,
      maxPdfTemplates: 1,
      canEditPdfSections: false,
      maxImagesPerProduct: 2,
      maxStorageMB: 200,
    },
    createdAt: new Date().toISOString(),
  },
  {
    name: "Profissional",
    tier: "pro",
    description: "Para empresas em crescimento",
    price: 0,
    pricing: {
      monthly: 0,
      yearly: 0,
    },
    order: 2,
    highlighted: true,
    features: {
      maxProposals: -1, // Unlimited
      maxClients: -1,
      maxProducts: -1,
      maxUsers: 10,
      hasFinancial: true,
      canCustomizeTheme: true,
      maxPdfTemplates: 3,
      canEditPdfSections: false,
      maxImagesPerProduct: 3,
      maxStorageMB: 2560, // 2.5GB
    },
    createdAt: new Date().toISOString(),
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    description: "Acesso total para grandes operações",
    price: 0,
    pricing: {
      monthly: 0,
      yearly: 0,
    },
    order: 3,
    features: {
      maxProposals: -1,
      maxClients: -1,
      maxProducts: -1,
      maxUsers: -1, // Unlimited
      hasFinancial: true,
      canCustomizeTheme: true,
      maxPdfTemplates: -1, // All templates
      canEditPdfSections: true,
      maxImagesPerProduct: 3,
      maxStorageMB: -1, // Unlimited
    },
    createdAt: new Date().toISOString(),
  },
];

export const PlanService = {
  /**
   * Get all available plans, ordered by hierarchy
   */
  getPlans: async (): Promise<UserPlan[]> => {
    // STRICT REQUIREMENT: Always fetch from Stripe. Never use generic/database fallbacks.
    const plans = await PlanService.getLivePlans();
    return plans || [];
  },

  /**
   * Get plans directly from Cloud Function (Stripe synced)
   * Use this when you need absolutely fresh prices
   */
  getLivePlans: async (): Promise<UserPlan[] | null> => {
    try {
      const { StripeService } = await import("./stripe-service");

      // Fetch directly from Stripe API
      const stripePlans = await StripeService.getPlans();

      if (stripePlans && stripePlans.length > 0) {
        console.log("[PlanService] Returning strict Stripe API data");
        // The API returns the exact structure we need, just force the type
        return stripePlans as unknown as UserPlan[];
      }

      console.warn(
        "[PlanService] StripeService.getPlans() returned empty data.",
      );
      // NEVER fallback to Firestore
      return null;
    } catch (error) {
      console.error("Failed to fetch live plans:", error);
      // NEVER fallback to Firestore
      return null;
    }
  },

  /**
   * Get a specific plan by ID
   */
  getPlanById: async (id: string): Promise<UserPlan | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserPlan;
      const defaultPlan = DEFAULT_PLANS.find((p) => p.tier === data.tier);

      return {
        ...data,
        id: docSnap.id,
        // Fallback to default pricing
        pricing: data.pricing || defaultPlan?.pricing,
        // Merge features with defaults to ensure new fields exist
        features: {
          ...defaultPlan?.features,
          ...data.features,
        },
      } as UserPlan;
    }
    return null;
  },

  /**
   * Get plan by tier name
   */
  getPlanByTier: async (tier: string): Promise<UserPlan | null> => {
    const plans = await PlanService.getPlans();
    return plans.find((p) => p.tier === tier) || null;
  },

  /**
   * Get the default free plan
   */
  getFreePlan: async (): Promise<UserPlan | null> => {
    return PlanService.getPlanByTier("free");
  },

  /**
   * Seed default plans into Firestore (uses fixed IDs to prevent duplicates)
   */
  seedDefaultPlans: async (): Promise<void> => {
    for (const plan of DEFAULT_PLANS) {
      // Use tier as the document ID to prevent duplicates
      const planDoc = doc(db, COLLECTION_NAME, plan.tier);
      await setDoc(planDoc, plan);
    }
    console.log("Default plans seeded successfully");
  },

  /**
   * Get plans that are upgrades from the current plan
   */
  getUpgradePlans: async (currentPlanId: string): Promise<UserPlan[]> => {
    const currentPlan = await PlanService.getPlanById(currentPlanId);
    if (!currentPlan) return [];

    const allPlans = await PlanService.getPlans();
    return allPlans.filter((p) => p.order > currentPlan.order);
  },

  /**
   * Format feature limit for display
   */
  formatLimit: (value: number): string => {
    return value === -1 ? "Ilimitado" : value.toString();
  },
};
