import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { UserPlan, PlanFeatures } from "@/types";

const COLLECTION_NAME = "plans";

// Default plans - these will be seeded if the collection is empty
export const DEFAULT_PLANS: Omit<UserPlan, "id">[] = [
  {
    name: "Starter",
    tier: "starter",
    description: "Ideal para pequenos negócios em crescimento",
    price: 97,
    pricing: {
      monthly: 97,
      yearly: 931,  // ~20% desconto (12 meses * 97 * 0.8)
    },
    order: 1,
    features: {
      maxProposals: 50,
      maxClients: 100,
      maxProducts: 200,
      maxUsers: 3,
      customBranding: true,
      prioritySupport: false,
      apiAccess: false,
      advancedReports: false,
    },
    createdAt: new Date().toISOString(),
  },
  {
    name: "Pro",
    tier: "pro",
    description: "Para empresas que precisam de mais poder",
    price: 197,
    pricing: {
      monthly: 197,
      yearly: 1891,  // ~20% desconto (12 meses * 197 * 0.8)
    },
    order: 2,
    highlighted: true,
    features: {
      maxProposals: -1, // Unlimited
      maxClients: -1,
      maxProducts: -1,
      maxUsers: 10,
      customBranding: true,
      prioritySupport: true,
      apiAccess: true,
      advancedReports: true,
    },
    createdAt: new Date().toISOString(),
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    description: "Solução completa para grandes operações",
    price: 497,
    pricing: {
      monthly: 497,
      yearly: 4771,  // ~20% desconto (12 meses * 497 * 0.8)
    },
    order: 3,
    features: {
      maxProposals: -1,
      maxClients: -1,
      maxProducts: -1,
      maxUsers: -1, // Unlimited
      customBranding: true,
      prioritySupport: true,
      apiAccess: true,
      advancedReports: true,
    },
    createdAt: new Date().toISOString(),
  },
];

export const PlanService = {
  /**
   * Get all available plans, ordered by hierarchy
   */
  getPlans: async (): Promise<UserPlan[]> => {
    try {
      // Try to fetch from API first (which syncs with Stripe)
      const response = await fetch('/api/plans');
      if (response.ok) {
        const plans = await response.json();
        if (plans && plans.length > 0) return plans;
      }
    } catch (error) {
      console.warn("Failed to fetch plans from API, falling back to Firestore/Defaults", error);
    }

    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    
    // If no plans exist, seed with defaults
    if (querySnapshot.empty) {
      await PlanService.seedDefaultPlans();
      // Return defaults directly to avoid recursion loop if API fails
      return DEFAULT_PLANS.map(p => ({...p, id: p.tier} as UserPlan));
    }
    
    const plans = querySnapshot.docs.map((doc) => {
      const data = doc.data() as UserPlan;
      const defaultPlan = DEFAULT_PLANS.find(p => p.tier === data.tier);
      
      return {
        ...data,
        id: doc.id,
        // Fallback to default pricing if missing (handles old data)
        pricing: data.pricing || defaultPlan?.pricing,
      };
    }) as UserPlan[];
    
    // Sort by order
    return plans.sort((a, b) => a.order - b.order);
  },

  /**
   * Get a specific plan by ID
   */
  getPlanById: async (id: string): Promise<UserPlan | null> => {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserPlan;
      const defaultPlan = DEFAULT_PLANS.find(p => p.tier === data.tier);
      
      return { 
        ...data,
        id: docSnap.id, 
        // Fallback to default pricing
        pricing: data.pricing || defaultPlan?.pricing,
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
