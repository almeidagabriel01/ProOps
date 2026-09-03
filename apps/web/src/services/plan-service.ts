import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { UserPlan } from "@/types";

const COLLECTION_NAME = "plans";

const PLANS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _plansCache: { data: UserPlan[]; expiresAt: number } | null = null;
let _inFlightRequest: Promise<UserPlan[] | null> | null = null;

// Default plans - FALLBACK ONLY when Stripe is unavailable
// IMPORTANT: In production, prices come from Stripe via StripeService.getPlans()
// These values are only used as a last resort if Stripe API fails
//
// As FEATURES aqui espelham PLAN_CATALOG em
// apps/functions/src/shared/plan-capabilities.ts, que é a fonte da verdade.
// Guard de paridade: src/__tests__/plan-capabilities-parity.test.ts falha se
// divergirem — foi digitar os mesmos planos em cinco lugares que produziu o
// bug de `free.maxProposals` valer 5 numa tabela e 15 noutra.
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
      maxUsers: 1,
      maxWallets: 5,
      maxSpreadsheets: 25,
      maxPdfTemplates: 1,
      maxImagesPerProduct: 2,
      maxStorageMB: 200,
      aiMessagesPerMonth: 80,
      hasFinancial: false,
      hasKanban: false,
      hasFiscal: false,
      hasCalendarSync: false,
      hasWhatsApp: false,
      canCustomizeTheme: false,
      canEditPdfSections: false,
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
      maxUsers: 2,
      maxWallets: 30,
      maxSpreadsheets: 250,
      maxPdfTemplates: -1,
      maxImagesPerProduct: 3,
      maxStorageMB: 2560, // 2.5GB
      aiMessagesPerMonth: 400,
      hasFinancial: true,
      hasKanban: false,
      hasFiscal: false,
      hasCalendarSync: true,
      hasWhatsApp: false,
      canCustomizeTheme: true,
      canEditPdfSections: true,
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
      maxWallets: -1,
      maxSpreadsheets: -1,
      maxPdfTemplates: -1, // All templates
      maxImagesPerProduct: 3,
      maxStorageMB: -1, // Unlimited
      aiMessagesPerMonth: 1200,
      hasFinancial: true,
      hasKanban: true,
      hasFiscal: true,
      hasCalendarSync: true,
      hasWhatsApp: true,
      canCustomizeTheme: true,
      canEditPdfSections: true,
    },
    createdAt: new Date().toISOString(),
  },
];

function normalizePlanLookupValue(value?: string | null): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

function findMatchingPlan(
  plans: UserPlan[],
  candidates: Array<string | null | undefined>,
): UserPlan | null {
  const normalizedCandidates = candidates
    .map((candidate) => normalizePlanLookupValue(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  if (normalizedCandidates.length === 0) {
    return null;
  }

  return (
    plans.find((plan) => {
      const planKeys = [
        normalizePlanLookupValue(plan.id),
        normalizePlanLookupValue(plan.tier),
      ].filter((key): key is string => Boolean(key));

      return normalizedCandidates.some((candidate) => planKeys.includes(candidate));
    }) || null
  );
}

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
   * Get plans directly from Cloud Function (Stripe synced).
   * Results are cached for 5 minutes; concurrent callers share one in-flight request.
   */
  getLivePlans: async (): Promise<UserPlan[] | null> => {
    const now = Date.now();

    if (_plansCache && now < _plansCache.expiresAt) {
      return _plansCache.data;
    }

    if (_inFlightRequest) {
      return _inFlightRequest;
    }

    _inFlightRequest = (async () => {
      try {
        const { StripeService } = await import("./stripe-service");
        const stripePlans = await StripeService.getPlans();

        if (stripePlans && stripePlans.length > 0) {
          const plans = stripePlans as unknown as UserPlan[];
          _plansCache = { data: plans, expiresAt: Date.now() + PLANS_CACHE_TTL_MS };
          return plans;
        }

        console.warn("[PlanService] StripeService.getPlans() returned empty data.");
        return null;
      } catch (error) {
        console.error("Failed to fetch live plans:", error);
        return null;
      } finally {
        _inFlightRequest = null;
      }
    })();

    return _inFlightRequest;
  },

  /**
   * Get a specific plan by ID
   */
  getPlanById: async (id: string): Promise<UserPlan | null> => {
    const livePlans = await PlanService.getLivePlans();
    const directLiveMatch = livePlans ? findMatchingPlan(livePlans, [id]) : null;
    if (directLiveMatch) {
      return directLiveMatch;
    }

    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as UserPlan;
      const defaultPlan = DEFAULT_PLANS.find((p) => p.tier === data.tier);

       const liveMatchFromStoredTier = livePlans
        ? findMatchingPlan(livePlans, [data.tier, docSnap.id])
        : null;

      if (liveMatchFromStoredTier) {
        return liveMatchFromStoredTier;
      }

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
