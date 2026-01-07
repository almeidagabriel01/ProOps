import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
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
    price: 79,
    pricing: {
      monthly: 79,
      yearly: 804, // ~15% desconto (R$ 67/mês)
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
    price: 149,
    pricing: {
      monthly: 149,
      yearly: 1524, // ~15% desconto (R$ 127/mês)
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
    price: 299,
    pricing: {
      monthly: 299,
      yearly: 3048, // ~15% desconto (R$ 254/mês)
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
    // We rely on Firestore for speed. Live prices are fetched separately if needed.
    // try {
    //   // Try to fetch from Cloud Function first (which syncs with Stripe)
    //   const { StripeService } = await import("./stripe-service");
    //   const plans = await StripeService.getPlans();
    //   if (plans && plans.length > 0) {
    //     return plans as UserPlan[];
    //   }
    // } catch (error) {
    //   console.warn(
    //     "Failed to fetch plans from Cloud Function, falling back to Firestore/Defaults",
    //     error
    //   );
    // }

    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));

    // If no plans exist, seed with defaults
    if (querySnapshot.empty) {
      await PlanService.seedDefaultPlans();
      // Return defaults directly to avoid recursion loop if API fails
      return DEFAULT_PLANS.map((p) => ({ ...p, id: p.tier }) as UserPlan);
    }

    const plans = querySnapshot.docs.map((doc) => {
      const data = doc.data() as UserPlan;
      const defaultPlan = DEFAULT_PLANS.find((p) => p.tier === data.tier);

      return {
        ...data,
        id: doc.id,
        name: data.name || defaultPlan?.name || "Plano Desconhecido",
        description: data.description || defaultPlan?.description,
        price: data.price || defaultPlan?.price || 0,
        // Fallback to default pricing if missing (handles old data)
        pricing: data.pricing || defaultPlan?.pricing,
        // Merge features: defaults provide new fields, Firestore data takes priority
        features: {
          ...defaultPlan?.features,
          ...data.features,
        },
      };
    }) as UserPlan[];

    // Sort by order
    return plans.sort((a, b) => a.order - b.order);
  },

  /**
   * Get plans directly from Cloud Function (Stripe synced)
   * Use this when you need absolutely fresh prices
   */
  getLivePlans: async (): Promise<UserPlan[] | null> => {
    try {
      const { StripeService } = await import("./stripe-service");
      const plans = await StripeService.getPlans();
      if (plans && plans.length > 0) {
        return plans as UserPlan[];
      }
      return null;
    } catch (error) {
      console.warn("Failed to fetch live plans:", error);
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
