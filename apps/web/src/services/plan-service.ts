import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { UserPlan } from "@/types";
import { DEFAULT_PLANS } from "@/lib/plans/default-plans";

const COLLECTION_NAME = "plans";

const PLANS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _plansCache: { data: UserPlan[]; expiresAt: number } | null = null;
let _inFlightRequest: Promise<UserPlan[] | null> | null = null;

export { DEFAULT_PLANS };

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
