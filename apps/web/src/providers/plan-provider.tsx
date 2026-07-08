"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import {
  PlanFeatures,
  AddonType,
  PlanTier,
  PurchasedAddon,
  User,
} from "@/types";
import { PlanService, DEFAULT_PLANS } from "@/services/plan-service";
import { AddonService } from "@/services/addon-service";
import { computeTrialInfo, type TrialInfo } from "@/lib/trial-info";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREE_PLAN_FEATURES: PlanFeatures = {
  maxProposals: 5,
  maxClients: 10,
  maxProducts: 20,
  maxUsers: 1,
  hasFinancial: false,
  canCustomizeTheme: false,
  maxPdfTemplates: 1,
  canEditPdfSections: false,
  hasKanban: false,
  maxImagesPerProduct: 2,
  maxStorageMB: 50,
};

const ADDON_GRACE_PERIOD_DAYS = 7;

// past_due is intentionally excluded: backend enforces a 7-day grace period
// (ADDON_GRACE_PERIOD_DAYS). Addons remain accessible during this window and
// the top banner already warns the user. Zeroing addons here contradicted the
// backend grace period and created false "access lost" complaints.
const BLOCKED_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "cancelled",
  "unpaid",
  "inactive",
  "payment_failed",
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddonGracePeriodInfo {
  addon: PurchasedAddon;
  daysRemaining: number;
  isExpired: boolean;
}


/** Named feature flags derived from tenant/plan state. */
export type FeatureFlag = "whatsapp";

export interface PlanContextValue {
  features: PlanFeatures | null;
  isLoading: boolean;
  purchasedAddons: AddonType[];
  purchasedAddonsData: PurchasedAddon[];
  pastDueAddons: AddonGracePeriodInfo[];
  trialInfo: TrialInfo;
  hasFinancial: boolean;
  hasKanban: boolean;
  hasWhatsApp: boolean;
  canCustomizeTheme: boolean;
  canEditPdfSections: boolean;
  canCreateProposal: () => Promise<boolean>;
  canCreateClient: () => Promise<boolean>;
  canCreateProduct: () => Promise<boolean>;
  canAddUser: () => Promise<boolean>;
  getProposalCount: () => Promise<number>;
  getClientCount: () => Promise<number>;
  getProductCount: () => Promise<number>;
  getUserCount: () => Promise<number>;
  getProposalLimit: () => string;
  getClientLimit: () => string;
  getProductLimit: () => string;
  getUserLimit: () => string;
  planTier: PlanTier;
  refreshAddons: () => Promise<void>;
  featureFlags: Record<FeatureFlag, boolean>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PlanContext = createContext<PlanContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { tenant, tenantOwner, isLoading: isTenantLoading } = useTenant();

  const [baseFeatures, setBaseFeatures] = useState<PlanFeatures | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("starter");
  const [purchasedAddons, setPurchasedAddons] = useState<AddonType[]>([]);
  const [purchasedAddonsData, setPurchasedAddonsData] = useState<
    PurchasedAddon[]
  >([]);
  const [pastDueAddonsData, setPastDueAddonsData] = useState<PurchasedAddon[]>(
    [],
  );
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [isAddonsLoading, setIsAddonsLoading] = useState(true);

  const masterId = (user as User & { masterId?: string })?.masterId;

  // -------------------------------------------------------------------------
  // Effect: load plan features
  // -------------------------------------------------------------------------

  useEffect(() => {
    const loadFeatures = async () => {
      if (!user) {
        setBaseFeatures(FREE_PLAN_FEATURES);
        setPlanTier("starter");
        setIsPlanLoading(false);
        return;
      }

      setIsPlanLoading(true);

      if (user?.role === "superadmin") {
        setBaseFeatures({
          maxProposals: -1,
          maxClients: -1,
          maxProducts: -1,
          maxUsers: -1,
          hasFinancial: true,
          canCustomizeTheme: true,
          maxPdfTemplates: -1,
          canEditPdfSections: true,
          hasKanban: true,
          maxImagesPerProduct: 3,
          maxStorageMB: -1,
        });
        setPlanTier("enterprise");
        setIsPlanLoading(false);
        return;
      }

      let effectivePlanId = user?.planId;
      const currentUser = user as { masterId?: string; planId?: string };

      if (
        (!effectivePlanId || effectivePlanId === "free") &&
        currentUser?.masterId
      ) {
        try {
          const masterRef = doc(db, "users", currentUser.masterId);
          const masterSnap = await getDoc(masterRef);
          if (masterSnap.exists()) {
            effectivePlanId = masterSnap.data().planId;
          }
        } catch (err) {
          console.warn(
            "Expected permission error fetching master plan directly in PlanProvider. Using tenant owner plan if available.",
            err,
          );
          if (tenantOwner?.planId) {
            effectivePlanId = tenantOwner.planId;
          }
        }
      }

      if (!effectivePlanId) {
        setBaseFeatures(FREE_PLAN_FEATURES);
        setPlanTier("starter");
        setIsPlanLoading(false);
        return;
      }

      try {
        let plan = await PlanService.getPlanById(effectivePlanId);

        if (!plan) {
          plan = await PlanService.getPlanByTier(effectivePlanId);
        }

        if (plan?.features) {
          setBaseFeatures(plan.features);
          const tierValue = plan.tier || effectivePlanId;
          const normalizedTier = tierValue?.toLowerCase() as PlanTier;
          setPlanTier(normalizedTier);
        } else {
          const fallbackPlan = DEFAULT_PLANS.find(
            (p) =>
              p.tier === effectivePlanId ||
              p.tier === effectivePlanId?.toLowerCase(),
          );
          if (fallbackPlan?.features) {
            setBaseFeatures(fallbackPlan.features);
            setPlanTier(fallbackPlan.tier?.toLowerCase() as PlanTier);
          } else {
            console.warn(
              "Could not load plan features for planId:",
              effectivePlanId,
            );
            setBaseFeatures(FREE_PLAN_FEATURES);
            setPlanTier("starter");
          }
        }
      } catch (error) {
        console.error("Error loading plan features:", error);
        setBaseFeatures(FREE_PLAN_FEATURES);
        setPlanTier("starter");
      }

      setIsPlanLoading(false);
    };

    loadFeatures();
  }, [user, user?.role, user?.planId, masterId, tenantOwner]);

  // -------------------------------------------------------------------------
  // Effect: load add-ons
  // -------------------------------------------------------------------------

  useEffect(() => {
    const loadAddonsAsync = async () => {
      if (!user) {
        setPurchasedAddons([]);
        setPurchasedAddonsData([]);
        setPastDueAddonsData([]);
        setIsAddonsLoading(false);
        return;
      }

      if (user?.role === "superadmin") {
        setPurchasedAddons([]);
        setPurchasedAddonsData([]);
        setPastDueAddonsData([]);
        setIsAddonsLoading(false);
        return;
      }

      if (isTenantLoading) {
        setIsAddonsLoading(true);
        return;
      }

      setIsAddonsLoading(true);

      if (!tenant?.id) {
        setPurchasedAddons([]);
        setPurchasedAddonsData([]);
        setPastDueAddonsData([]);
        setIsAddonsLoading(false);
        return;
      }

      if (BLOCKED_SUBSCRIPTION_STATUSES.has(tenant?.subscriptionStatus ?? "")) {
        setPurchasedAddons([]);
        setPurchasedAddonsData([]);
        setPastDueAddonsData([]);
        setIsAddonsLoading(false);
        return;
      }

      try {
        const allAddons = await AddonService.getAddonsWithPastDue(tenant.id);

        const activeAddons = allAddons.filter((a) => a.status === "active");
        const pastDueAddons = allAddons.filter((a) => a.status === "past_due");

        const now = new Date();
        const validPastDueAddons = pastDueAddons.filter((addon) => {
          if (!addon.currentPeriodEnd) return true;
          const periodEnd = new Date(addon.currentPeriodEnd);
          const deadline = new Date(periodEnd);
          deadline.setDate(deadline.getDate() + ADDON_GRACE_PERIOD_DAYS);
          return now < deadline;
        });

        const effectiveAddons = [...activeAddons, ...validPastDueAddons];
        const addonTypes = effectiveAddons.map((a) => a.addonType);

        setPurchasedAddons(addonTypes);
        setPurchasedAddonsData(effectiveAddons);
        setPastDueAddonsData(pastDueAddons);
      } catch (error) {
        if ((error as { code?: string })?.code === "permission-denied") {
          setIsAddonsLoading(false);
          return;
        }
        console.error("Error loading add-ons:", error);
        setPurchasedAddons([]);
        setPurchasedAddonsData([]);
        setPastDueAddonsData([]);
      } finally {
        setIsAddonsLoading(false);
      }
    };

    loadAddonsAsync();
  }, [tenant, isTenantLoading, user]);

  // -------------------------------------------------------------------------
  // refreshAddons
  // -------------------------------------------------------------------------

  const refreshAddons = useCallback(async () => {
    if (user?.role === "superadmin") {
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
      setPastDueAddonsData([]);
      return;
    }

    if (!tenant?.id) {
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
      return;
    }

    if (BLOCKED_SUBSCRIPTION_STATUSES.has(tenant?.subscriptionStatus ?? "")) {
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
      return;
    }

    try {
      const allAddons = await AddonService.getAddonsWithPastDue(tenant.id);

      const activeAddons = allAddons.filter((a) => a.status === "active");
      const pastDueAddons = allAddons.filter((a) => a.status === "past_due");

      const now = new Date();
      const validPastDueAddons = pastDueAddons.filter((addon) => {
        if (!addon.currentPeriodEnd) return true;
        const periodEnd = new Date(addon.currentPeriodEnd);
        const deadline = new Date(periodEnd);
        deadline.setDate(deadline.getDate() + ADDON_GRACE_PERIOD_DAYS);
        return now < deadline;
      });

      const effectiveAddons = [...activeAddons, ...validPastDueAddons];
      setPurchasedAddons(effectiveAddons.map((a) => a.addonType));
      setPurchasedAddonsData(effectiveAddons);
      setPastDueAddonsData(pastDueAddons);
    } catch (error) {
      if ((error as { code?: string })?.code === "permission-denied") return;
      console.error("Error loading add-ons:", error);
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
    }
  }, [tenant, user?.role]);

  // -------------------------------------------------------------------------
  // Derived: merge base features with add-ons
  // -------------------------------------------------------------------------

  const addonAugmented = useMemo(() => {
    if (!baseFeatures) return null;
    return AddonService.applyAddonsToFeatures(
      {
        hasFinancial: baseFeatures.hasFinancial,
        canEditPdfSections: baseFeatures.canEditPdfSections,
        maxPdfTemplates: baseFeatures.maxPdfTemplates,
        hasKanban: baseFeatures.hasKanban,
        canCustomizeTheme: baseFeatures.canCustomizeTheme,
        maxUsers: baseFeatures.maxUsers,
      },
      purchasedAddons,
    ) as unknown as PlanFeatures;
  }, [baseFeatures, purchasedAddons]);

  const mergedFeatures = useMemo(() => {
    if (!baseFeatures || !addonAugmented) return null;
    return {
      ...baseFeatures,
      hasFinancial: addonAugmented.hasFinancial,
      canEditPdfSections: addonAugmented.canEditPdfSections,
      maxPdfTemplates: addonAugmented.maxPdfTemplates,
      hasKanban: addonAugmented.hasKanban,
      canCustomizeTheme: addonAugmented.canCustomizeTheme,
      maxUsers: addonAugmented.maxUsers,
    };
  }, [baseFeatures, addonAugmented]);

  // -------------------------------------------------------------------------
  // Count helpers
  // -------------------------------------------------------------------------

  const getProposalCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    if (user?.role?.toLowerCase() === "free") return 0;
    const q = query(
      collection(db, "proposals"),
      where("tenantId", "==", tenant.id),
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant, user]);

  const getClientCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    if (user?.role?.toLowerCase() === "free") return 0;
    const q = query(
      collection(db, "clients"),
      where("tenantId", "==", tenant.id),
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant, user]);

  const getProductCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    if (user?.role?.toLowerCase() === "free") return 0;
    const q = query(
      collection(db, "products"),
      where("tenantId", "==", tenant.id),
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant, user]);

  const getUserCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    if (user?.role?.toLowerCase() === "free") return 0;
    if (user?.role?.toLowerCase() === "member") return 0;
    const q = query(
      collection(db, "users"),
      where("tenantId", "==", tenant.id),
      where("role", "==", "MEMBER"),
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant, user]);

  // -------------------------------------------------------------------------
  // Can-create helpers
  // -------------------------------------------------------------------------

  const canCreateProposal = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxProposals;
    const limit = Number(limitVal);
    if (String(limitVal) === "-1" || limit === -1 || limit < 0) return true;
    const count = await getProposalCount();
    return count < limit;
  }, [mergedFeatures, getProposalCount]);

  const canCreateClient = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxClients;
    const limit = Number(limitVal);
    if (String(limitVal) === "-1" || limit === -1 || limit < 0) return true;
    const count = await getClientCount();
    return count < limit;
  }, [mergedFeatures, getClientCount]);

  const canCreateProduct = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxProducts;
    const limit = Number(limitVal);
    if (String(limitVal) === "-1" || limit === -1 || limit < 0) return true;
    const count = await getProductCount();
    return count < limit;
  }, [mergedFeatures, getProductCount]);

  const canAddUser = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxUsers;
    const limit = Number(limitVal);
    if (String(limitVal) === "-1" || limit === -1 || limit < 0) return true;
    const count = await getUserCount();
    return count < limit;
  }, [mergedFeatures, getUserCount]);

  // -------------------------------------------------------------------------
  // Limit label helpers
  // -------------------------------------------------------------------------

  const formatLimit = (value: number): string =>
    value === -1 ? "Ilimitado" : value.toString();

  // -------------------------------------------------------------------------
  // pastDueAddons (grace period info)
  // -------------------------------------------------------------------------

  const pastDueAddons = useMemo((): AddonGracePeriodInfo[] => {
    const now = new Date();
    return pastDueAddonsData.map((addon) => {
      const periodEnd = addon.currentPeriodEnd
        ? new Date(addon.currentPeriodEnd)
        : now;
      const deadline = new Date(periodEnd);
      deadline.setDate(deadline.getDate() + ADDON_GRACE_PERIOD_DAYS);
      const diffTime = deadline.getTime() - now.getTime();
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        addon,
        daysRemaining: Math.max(0, days),
        isExpired: days <= 0,
      };
    });
  }, [pastDueAddonsData]);

  // -------------------------------------------------------------------------
  // Trial info (7-day paid trial countdown)
  // -------------------------------------------------------------------------

  const trialInfo = useMemo(
    (): TrialInfo =>
      computeTrialInfo(tenant?.subscriptionStatus, tenant?.trialEndsAt),
    [tenant?.subscriptionStatus, tenant?.trialEndsAt],
  );

  // -------------------------------------------------------------------------
  // Feature flags (derived from tenant state)
  // -------------------------------------------------------------------------

  const featureFlags = useMemo(
    (): Record<FeatureFlag, boolean> => ({
      whatsapp: Boolean(tenant?.whatsappEnabled),
    }),
    [tenant?.whatsappEnabled],
  );

  // -------------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------------

  const value = useMemo(
    (): PlanContextValue => ({
      features: mergedFeatures,
      isLoading: isPlanLoading || isAddonsLoading,
      purchasedAddons,
      purchasedAddonsData,
      pastDueAddons,
      trialInfo,
      hasFinancial: mergedFeatures?.hasFinancial ?? false,
      hasKanban: mergedFeatures?.hasKanban ?? false,
      hasWhatsApp: featureFlags.whatsapp,
      canCustomizeTheme: mergedFeatures?.canCustomizeTheme ?? false,
      canEditPdfSections: mergedFeatures?.canEditPdfSections ?? false,
      canCreateProposal,
      canCreateClient,
      canCreateProduct,
      canAddUser,
      getProposalCount,
      getClientCount,
      getProductCount,
      getUserCount,
      getProposalLimit: () => formatLimit(mergedFeatures?.maxProposals ?? 0),
      getClientLimit: () => formatLimit(mergedFeatures?.maxClients ?? 0),
      getProductLimit: () => formatLimit(mergedFeatures?.maxProducts ?? 0),
      getUserLimit: () => formatLimit(mergedFeatures?.maxUsers ?? 0),
      planTier,
      refreshAddons,
      featureFlags,
    }),
    [
      mergedFeatures,
      isPlanLoading,
      isAddonsLoading,
      purchasedAddons,
      purchasedAddonsData,
      pastDueAddons,
      trialInfo,
      canCreateProposal,
      canCreateClient,
      canCreateProduct,
      canAddUser,
      getProposalCount,
      getClientCount,
      getProductCount,
      getUserCount,
      planTier,
      refreshAddons,
      featureFlags,
    ],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

export function usePlanContext(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlanContext must be used within PlanProvider");
  return ctx;
}

export function useFeature(name: FeatureFlag): boolean {
  const { featureFlags } = usePlanContext();
  return featureFlags[name];
}
