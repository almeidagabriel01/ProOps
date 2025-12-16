"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { PlanFeatures } from "@/types";
import { PlanService, DEFAULT_PLANS } from "@/services/plan-service";
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
  // Features
  features: PlanFeatures | null;
  isLoading: boolean;
  
  // Quick access checks
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
}

export function usePlanLimits(): UsePlanLimitsReturn {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [features, setFeatures] = useState<PlanFeatures | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load plan features
  useEffect(() => {
    const loadFeatures = async () => {
      setIsLoading(true);
      
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
        setFeatures(FREE_PLAN_FEATURES);
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
          setFeatures(plan.features);
        } else {
          // Last fallback: use DEFAULT_PLANS by tier
          const fallbackPlan = DEFAULT_PLANS.find(p => p.tier === effectivePlanId);
          if (fallbackPlan?.features) {
            setFeatures(fallbackPlan.features);
          } else {
            console.warn("Could not load plan features for planId:", effectivePlanId);
            setFeatures(FREE_PLAN_FEATURES);
          }
        }
      } catch (error) {
        console.error("Error loading plan features:", error);
        setFeatures(FREE_PLAN_FEATURES);
      }
      
      setIsLoading(false);
    };

    loadFeatures();
  }, [user]);

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
    if (!features) return false;
    if (features.maxProposals === -1) return true;
    
    const count = await getProposalCount();
    return count < features.maxProposals;
  }, [features, getProposalCount]);

  // Check if can create client
  const canCreateClient = useCallback(async (): Promise<boolean> => {
    if (!features) return false;
    if (features.maxClients === -1) return true;
    
    const count = await getClientCount();
    return count < features.maxClients;
  }, [features, getClientCount]);

  // Check if can create product
  const canCreateProduct = useCallback(async (): Promise<boolean> => {
    if (!features) return false;
    if (features.maxProducts === -1) return true;
    
    const count = await getProductCount();
    return count < features.maxProducts;
  }, [features, getProductCount]);

  // Check if can add user
  const canAddUser = useCallback(async (): Promise<boolean> => {
    if (!features) return false;
    if (features.maxUsers === -1) return true;
    
    const count = await getUserCount();
    return count < features.maxUsers;
  }, [features, getUserCount]);

  // Format limits for display
  const formatLimit = (value: number): string => {
    return value === -1 ? "Ilimitado" : value.toString();
  };

  return {
    features,
    isLoading,
    
    // Quick access
    hasFinancial: features?.hasFinancial ?? false,
    canCustomizeTheme: features?.canCustomizeTheme ?? false,
    canEditPdfSections: features?.canEditPdfSections ?? false,
    
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
    getProposalLimit: () => formatLimit(features?.maxProposals ?? 0),
    getClientLimit: () => formatLimit(features?.maxClients ?? 0),
    getProductLimit: () => formatLimit(features?.maxProducts ?? 0),
    getUserLimit: () => formatLimit(features?.maxUsers ?? 0),
  };
}
