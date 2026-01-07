"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const FREE_PLAN_FEATURES: PlanFeatures = {
  maxProposals: 5,
  maxClients: 10,
  maxProducts: 20,
  maxUsers: 1,
  hasFinancial: false,
  canCustomizeTheme: false,
  maxPdfTemplates: 1,
  canEditPdfSections: false,
  maxImagesPerProduct: 2,
  maxStorageMB: 50, // 50MB for free users
};

// Grace period for add-ons (same as plans)
const ADDON_GRACE_PERIOD_DAYS = 7;

export interface AddonGracePeriodInfo {
  addon: PurchasedAddon;
  daysRemaining: number;
  isExpired: boolean;
}

interface UsePlanLimitsReturn {
  features: PlanFeatures | null;
  isLoading: boolean;

  purchasedAddons: AddonType[];
  purchasedAddonsData: PurchasedAddon[];
  pastDueAddons: AddonGracePeriodInfo[];

  hasFinancial: boolean;
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
}

export function usePlanLimits(): UsePlanLimitsReturn {
  const { user } = useAuth();
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const [baseFeatures, setBaseFeatures] = useState<PlanFeatures | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("starter");
  const [purchasedAddons, setPurchasedAddons] = useState<AddonType[]>([]);
  const [purchasedAddonsData, setPurchasedAddonsData] = useState<
    PurchasedAddon[]
  >([]);
  const [pastDueAddonsData, setPastDueAddonsData] = useState<PurchasedAddon[]>(
    []
  );
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [isAddonsLoading, setIsAddonsLoading] = useState(true);

  useEffect(() => {
    const loadFeatures = async () => {
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
          maxImagesPerProduct: 3,
          maxStorageMB: -1, // Unlimited
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
          console.error("Error fetching master plan:", err);
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
          setPlanTier(plan.tier as PlanTier);
        } else {
          const fallbackPlan = DEFAULT_PLANS.find(
            (p) => p.tier === effectivePlanId
          );
          if (fallbackPlan?.features) {
            setBaseFeatures(fallbackPlan.features);
            setPlanTier(fallbackPlan.tier as PlanTier);
          } else {
            console.warn(
              "Could not load plan features for planId:",
              effectivePlanId
            );
            setBaseFeatures(FREE_PLAN_FEATURES);
            setPlanTier("starter");
          }
        }
      } catch (error) {
        console.error("Error loading plan features:", error);
        setBaseFeatures(FREE_PLAN_FEATURES);
      }

      setIsPlanLoading(false);
    };

    loadFeatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    user?.role,
    user?.planId,
    (user as User & { masterId?: string })?.masterId,
  ]);

  // Load addons when tenant changes or finishes loading
  useEffect(() => {
    const loadAddonsAsync = async () => {
      // If tenant is still loading globally, keep addons loading state true
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

      try {
        // Get all addons including past_due for grace period handling
        const allAddons = await AddonService.getAddonsWithPastDue(tenant.id);

        // Separate active and past_due addons
        const activeAddons = allAddons.filter((a) => a.status === "active");
        const pastDueAddons = allAddons.filter((a) => a.status === "past_due");

        // Calculate which past_due addons are still in grace period
        const now = new Date();
        const validPastDueAddons = pastDueAddons.filter((addon) => {
          if (!addon.currentPeriodEnd) return true; // No date set, assume in grace
          const periodEnd = new Date(addon.currentPeriodEnd);
          const deadline = new Date(periodEnd);
          deadline.setDate(deadline.getDate() + ADDON_GRACE_PERIOD_DAYS);
          return now < deadline;
        });

        // Combine active + valid past_due for features
        const effectiveAddons = [...activeAddons, ...validPastDueAddons];
        const addonTypes = effectiveAddons.map((a) => a.addonType);

        setPurchasedAddons(addonTypes);
        setPurchasedAddonsData(effectiveAddons);
        setPastDueAddonsData(pastDueAddons);
      } catch (error) {
        console.error("Error loading add-ons:", error);
        setPurchasedAddons([]);
        setPurchasedAddonsData([]);
        setPastDueAddonsData([]);
      } finally {
        setIsAddonsLoading(false);
      }
    };

    loadAddonsAsync();
  }, [tenant, isTenantLoading]);

  // Refresh addons function (for external calls)
  const refreshAddons = useCallback(async () => {
    if (!tenant?.id) {
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
      return;
    }

    try {
      const addons = await AddonService.getAddonsForTenant(tenant.id);
      const addonTypes = addons.map((a) => a.addonType);
      setPurchasedAddons(addonTypes);
      setPurchasedAddonsData(addons);
    } catch (error) {
      console.error("Error loading add-ons:", error);
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
    }
  }, [tenant]);

  const features = useMemo(() => {
    if (!baseFeatures) return null;
    return AddonService.applyAddonsToFeatures(
      {
        hasFinancial: baseFeatures.hasFinancial,
        canEditPdfSections: baseFeatures.canEditPdfSections,
        maxPdfTemplates: baseFeatures.maxPdfTemplates,
        canCustomizeTheme: baseFeatures.canCustomizeTheme,
        maxUsers: baseFeatures.maxUsers,
      },
      purchasedAddons
    ) as unknown as PlanFeatures;
  }, [baseFeatures, purchasedAddons]);

  const mergedFeatures = useMemo(() => {
    if (!baseFeatures || !features) return null;

    const merged = {
      ...baseFeatures,
      hasFinancial: features.hasFinancial,
      canEditPdfSections: features.canEditPdfSections,
      maxPdfTemplates: features.maxPdfTemplates,
      canCustomizeTheme: features.canCustomizeTheme,
      maxUsers: features.maxUsers,
    };

    return merged;
  }, [baseFeatures, features]);

  const getProposalCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;

    const q = query(
      collection(db, "proposals"),
      where("tenantId", "==", tenant.id)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant]);

  const getClientCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;

    const q = query(
      collection(db, "clients"),
      where("tenantId", "==", tenant.id)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant]);

  const getProductCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;

    const q = query(
      collection(db, "products"),
      where("tenantId", "==", tenant.id)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant]);

  const getUserCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;

    // Members don't have permission to query other users
    // They don't need this info anyway (can't create team members)
    if (user?.role?.toLowerCase() === "member") {
      return 0;
    }

    // Only count MEMBER users (not MASTER/admin users)
    // The limit is for team members, not the account owner
    const q = query(
      collection(db, "users"),
      where("tenantId", "==", tenant.id),
      where("role", "==", "MEMBER")
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant, user]);

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

    if (String(limitVal) === "-1" || limit === -1 || limit < 0) {
      return true;
    }

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

  const formatLimit = (value: number): string => {
    return value === -1 ? "Ilimitado" : value.toString();
  };

  // Calculate past due addon grace period info
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
      const daysRemaining = Math.max(0, days);

      return {
        addon,
        daysRemaining,
        isExpired: days <= 0,
      };
    });
  }, [pastDueAddonsData]);

  return {
    features: mergedFeatures,
    isLoading: isPlanLoading || isAddonsLoading,

    purchasedAddons,
    purchasedAddonsData,
    pastDueAddons,

    hasFinancial: mergedFeatures?.hasFinancial ?? false,
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
  };
}
