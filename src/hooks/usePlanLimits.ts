"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { PlanFeatures, AddonType, PlanTier, PurchasedAddon } from "@/types";
import { PlanService, DEFAULT_PLANS } from "@/services/plan-service";
import { AddonService } from "@/services/addon-service";
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Default features for free/no plan users (most restrictive)
const FREE_PLAN_FEATURES: PlanFeatures = {
  maxProposals: 5,
  maxClients: 10,
  maxProducts: 20,
  maxUsers: 1,
  hasFinancial: false,
  canCustomizeTheme: false,
  maxPdfTemplates: 1,
  canEditPdfSections: false,
};

interface UsePlanLimitsReturn {
  // Features (base + add-ons merged)
  features: PlanFeatures | null;
  isLoading: boolean;
  
  // Purchased add-ons (just types for compatibility)
  purchasedAddons: AddonType[];
  // Full addon data with billing interval
  purchasedAddonsData: PurchasedAddon[];
  
  // Quick access checks (with add-ons applied)
  hasFinancial: boolean;
  canCustomizeTheme: boolean;
  canEditPdfSections: boolean;
  
  // Limit checking functions
  canCreateProposal: () => Promise<boolean>;
  canCreateClient: () => Promise<boolean>;
  canCreateProduct: () => Promise<boolean>;
  canAddUser: () => Promise<boolean>;
  
  // Get current counts
  getProposalCount: () => Promise<number>;
  getClientCount: () => Promise<number>;
  getProductCount: () => Promise<number>;
  getUserCount: () => Promise<number>;
  
  // Formatted limits
  getProposalLimit: () => string;
  getClientLimit: () => string;
  getProductLimit: () => string;
  getUserLimit: () => string;
  
  // Plan tier (for add-ons filtering)
  planTier: PlanTier;
  
  // Refresh add-ons (call after purchase/cancel)
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

  // Load purchased add-ons for tenant
  const loadAddons = useCallback(async () => {
    if (!tenant?.id) {
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
      return;
    }

    try {
      console.log('[usePlanLimits] Loading addons for tenant:', tenant.id);
      const addons = await AddonService.getAddonsForTenant(tenant.id);
      console.log('[usePlanLimits] Loaded addons:', addons);
      const addonTypes = addons.map(a => a.addonType);
      console.log('[usePlanLimits] Addon types:', addonTypes);
      setPurchasedAddons(addonTypes);
      setPurchasedAddonsData(addons);
    } catch (error) {
      console.error("Error loading add-ons:", error);
      setPurchasedAddons([]);
      setPurchasedAddonsData([]);
    }
  }, [tenant?.id]);

  // Load plan features
  useEffect(() => {
    const loadFeatures = async () => {
      setIsLoading(true);

      // Super Admin Override: Grants unlimited access regardless of tenant plan
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
          });
          setPlanTier("enterprise");
          setIsLoading(false);
          return;
      }
      
      // Determine effective plan ID
      let effectivePlanId = user?.planId;

      // Logic: If user is a member (no planId or free) and has a masterId,
      // we need to fetch the Master's plan.
      // We check 'masterId' from the user object (need to cast or ensure it exists).
      const currentUser = user as any;
      
      if ((!effectivePlanId || effectivePlanId === 'free') && currentUser?.masterId) {
         try {
             // Fetch master user doc
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
        // No plan - use free tier features
        setBaseFeatures(FREE_PLAN_FEATURES);
        setPlanTier("starter");
        setIsLoading(false);
        return;
      }

      try {
        // First try to get plan by ID (if planId is a document ID)
        let plan = await PlanService.getPlanById(effectivePlanId);
        
        // If not found by ID, try by tier (planId might be "pro", "starter", etc)
        if (!plan) {
          plan = await PlanService.getPlanByTier(effectivePlanId);
        }
        
        if (plan?.features) {
          setBaseFeatures(plan.features);
          setPlanTier(plan.tier as PlanTier);
        } else {
          // Last fallback: use DEFAULT_PLANS by tier
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

  // Load add-ons when tenant changes
  useEffect(() => {
    loadAddons();
  }, [loadAddons]);

  // Compute effective features (base + add-ons) - MUST use useMemo for reactivity
  const features = useMemo(() => {
    if (!baseFeatures) return null;
    
    console.log('[usePlanLimits] Computing features with addons:', purchasedAddons);
    
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

  // Merge with base features for complete PlanFeatures object
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
    
    console.log('[usePlanLimits] Merged features - hasFinancial:', merged.hasFinancial);
    
    return merged;
  }, [baseFeatures, features]);

  // Count total proposals
  const getProposalCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    
    const q = query(
      collection(db, "proposals"),
      where("tenantId", "==", tenant.id)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant?.id]);

  // Count clients
  const getClientCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    
    const q = query(
      collection(db, "clients"),
      where("tenantId", "==", tenant.id)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant?.id]);

  // Count products
  const getProductCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    
    const q = query(
      collection(db, "products"),
      where("tenantId", "==", tenant.id)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant?.id]);

  // Count users for this tenant
  const getUserCount = useCallback(async (): Promise<number> => {
    if (!tenant?.id) return 0;
    
    const q = query(
      collection(db, "users"),
      where("tenantId", "==", tenant.id)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  }, [tenant?.id]);

  // Check if can create proposal
  const canCreateProposal = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxProposals;
    const limit = Number(limitVal);
    if (String(limitVal) === '-1' || limit === -1 || limit < 0) return true;
    
    const count = await getProposalCount();
    return count < limit;
  }, [mergedFeatures, getProposalCount]);

  // Check if can create client
  const canCreateClient = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxClients;
    const limit = Number(limitVal);
    console.log(`[usePlanLimits] canCreateClient? Limit: ${limitVal} (Num: ${limit}), Current: waiting...`);
    
    if (String(limitVal) === '-1' || limit === -1 || limit < 0) {
        console.log(`[usePlanLimits] Unlimited clients allowed.`);
        return true;
    }
    
    const count = await getClientCount();
    console.log(`[usePlanLimits] Count: ${count}, Allowed: ${limit}`);
    return count < limit;
  }, [mergedFeatures, getClientCount]);

  // Check if can create product
  const canCreateProduct = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxProducts;
    const limit = Number(limitVal);
    if (String(limitVal) === '-1' || limit === -1 || limit < 0) return true;
    
    const count = await getProductCount();
    return count < limit;
  }, [mergedFeatures, getProductCount]);

  // Check if can add user
  const canAddUser = useCallback(async (): Promise<boolean> => {
    if (!mergedFeatures) return false;
    const limitVal = mergedFeatures.maxUsers;
    const limit = Number(limitVal);
    if (String(limitVal) === '-1' || limit === -1 || limit < 0) return true;
    
    const count = await getUserCount();
    return count < limit;
  }, [mergedFeatures, getUserCount]);

  // Format limits for display
  const formatLimit = (value: number): string => {
    return value === -1 ? "Ilimitado" : value.toString();
  };

  return {
    features: mergedFeatures,
    isLoading,
    
    // Purchased add-ons
    purchasedAddons,
    purchasedAddonsData,
    
    // Quick access (with add-ons applied)
    hasFinancial: mergedFeatures?.hasFinancial ?? false,
    canCustomizeTheme: mergedFeatures?.canCustomizeTheme ?? false,
    canEditPdfSections: mergedFeatures?.canEditPdfSections ?? false,
    
    // Functions
    canCreateProposal,
    canCreateClient,
    canCreateProduct,
    canAddUser,
    
    getProposalCount,
    getClientCount,
    getProductCount,
    getUserCount,
    
    // Formatted limits
    getProposalLimit: () => formatLimit(mergedFeatures?.maxProposals ?? 0),
    getClientLimit: () => formatLimit(mergedFeatures?.maxClients ?? 0),
    getProductLimit: () => formatLimit(mergedFeatures?.maxProducts ?? 0),
    getUserLimit: () => formatLimit(mergedFeatures?.maxUsers ?? 0),
    
    // Plan tier (for add-ons filtering)
    planTier,
    
    // Refresh add-ons (call after purchase/cancel)
    refreshAddons: loadAddons,
  };
}
