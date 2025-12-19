"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { PlanFeatures, AddonType, PlanTier, PurchasedAddon } from "@/types";
import { PlanService, DEFAULT_PLANS } from "@/services/plan-service";
import { AddonService } from "@/services/addon-service";
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from "firebase/firestore";
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

interface UsePlanLimitsReturn {
  features: PlanFeatures | null;
  isLoading: boolean;
  
  purchasedAddons: AddonType[];
  purchasedAddonsData: PurchasedAddon[];
  
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
  const { tenant } = useTenant();
  const [baseFeatures, setBaseFeatures] = useState<PlanFeatures | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>("starter");
  const [purchasedAddons, setPurchasedAddons] = useState<AddonType[]>([]);
  const [purchasedAddonsData, setPurchasedAddonsData] = useState<PurchasedAddon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAddons = useCallback(async () => {
    if (!tenant?.id) {
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
      return;
    }

    try {

      const addons = await AddonService.getAddonsForTenant(tenant.id);

      const addonTypes = addons.map(a => a.addonType);

      setPurchasedAddons(addonTypes);
      setPurchasedAddonsData(addons);
    } catch (error) {
      console.error("Error loading add-ons:", error);
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
    }
  }, [tenant?.id]);

  useEffect(() => {
    const loadFeatures = async () => {
      setIsLoading(true);

      if (user?.role === 'superadmin') {
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
          setIsLoading(false);
          return;
      }
      
      let effectivePlanId = user?.planId;

      const currentUser = user as any;
      
      if ((!effectivePlanId || effectivePlanId === 'free') && currentUser?.masterId) {
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
        setIsLoading(false);
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
          const fallbackPlan = DEFAULT_PLANS.find(p => p.tier === effectivePlanId);
          if (fallbackPlan?.features) {
            setBaseFeatures(fallbackPlan.features);
            setPlanTier(fallbackPlan.tier as PlanTier);
          } else {
            console.warn("Could not load plan features for planId:", effectivePlanId);
            setBaseFeatures(FREE_PLAN_FEATURES);
            setPlanTier("starter");
          }
        }
      } catch (error) {
        console.error("Error loading plan features:", error);
        setBaseFeatures(FREE_PLAN_FEATURES);
      }
      
      setIsLoading(false);
    };

    loadFeatures();
  }, [user]);

  useEffect(() => {
    loadAddons();
  }, [loadAddons]);

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
  }, [tenant?.id]);

  const getClientCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    
    const q = query(
      collection(db, "clients"),
      where("tenantId", "==", tenant.id)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant?.id]);

  const getProductCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    
    const q = query(
      collection(db, "products"),
      where("tenantId", "==", tenant.id)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant?.id]);

  const getUserCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    
    const q = query(
      collection(db, "users"),
      where("tenantId", "==", tenant.id)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant?.id]);

  const canCreateProposal = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxProposals;
    const limit = Number(limitVal);
    if (String(limitVal) === '-1' || limit === -1 || limit < 0) return true;
    
    const count = await getProposalCount();
    return count < limit;
  }, [mergedFeatures, getProposalCount]);

  const canCreateClient = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxClients;
    const limit = Number(limitVal);

    
    if (String(limitVal) === '-1' || limit === -1 || limit < 0) {

        return true;
    }
    
    const count = await getClientCount();

    return count < limit;
  }, [mergedFeatures, getClientCount]);

  const canCreateProduct = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxProducts;
    const limit = Number(limitVal);
    if (String(limitVal) === '-1' || limit === -1 || limit < 0) return true;
    
    const count = await getProductCount();
    return count < limit;
  }, [mergedFeatures, getProductCount]);

  const canAddUser = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxUsers;
    const limit = Number(limitVal);
    if (String(limitVal) === '-1' || limit === -1 || limit < 0) return true;
    
    const count = await getUserCount();
    return count < limit;
  }, [mergedFeatures, getUserCount]);

  const formatLimit = (value: number): string => {
    return value === -1 ? "Ilimitado" : value.toString();
  };

  return {
    features: mergedFeatures,
    isLoading,
    
    purchasedAddons,
    purchasedAddonsData,
    
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
    
    refreshAddons: loadAddons,
  };
}
