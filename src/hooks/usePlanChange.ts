"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { UserPlan, User, Tenant, BillingInterval } from "@/types";
import { PlanPreview } from "@/types/plan";
import { PlanService } from "@/services/plan-service";
import { UserService } from "@/services/user-service";

interface UsePlanChangeReturn {
  // User data
  effectiveUser: User | null;

  // Plan data
  userPlan: UserPlan | null;
  allPlans: UserPlan[];
  isLoading: boolean;

  // Billing interval
  billingInterval: BillingInterval;
  setBillingInterval: (interval: BillingInterval) => void;

  // Plan change modal
  dialogOpen: boolean;
  selectedPlan: UserPlan | null;
  planPreview: PlanPreview | null;
  loadingPreview: boolean;
  isFirstSubscription: boolean;

  // Processing state
  upgradingPlan: string | null;
  downgradingPlan: string | null;
  openingPortal: boolean;

  // Actions
  handleUpgrade: (plan: UserPlan) => void;
  handleDowngrade: (plan: UserPlan) => void;
  confirmPlanChange: () => Promise<void>;
  handleManagePayment: () => Promise<void>;
  setDialogOpen: (open: boolean) => void;

  // Helpers
  isCurrentPlan: (plan: UserPlan) => boolean;
  canUpgrade: (plan: UserPlan) => boolean;
}

export function usePlanChange(
  user: User | null,
  tenant?: Tenant | null
): UsePlanChangeReturn {
  const searchParams = useSearchParams();

  // Plan state
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [allPlans, setAllPlans] = useState<UserPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Effective user (for superadmin viewing tenant)
  const [effectiveUser, setEffectiveUser] = useState<User | null>(null);

  // Processing state
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [downgradingPlan, setDowngradingPlan] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Billing interval
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<UserPlan | null>(null);
  const [planPreview, setPlanPreview] = useState<PlanPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isFirstSubscription, setIsFirstSubscription] = useState(false);

  const toastShownRef = useRef(false);

  // Determine effective user (for superadmin viewing tenant)
  useEffect(() => {
    const fetchEffectiveUser = async () => {
      // If superadmin is viewing another tenant, fetch that tenant's admin user
      if (user?.role === "superadmin" && tenant) {
        const tenantAdmin = await UserService.getTenantAdminUser(tenant.id);
        setEffectiveUser(tenantAdmin);
      } else {
        // Regular user or no tenant viewing
        setEffectiveUser(user);
      }
    };

    fetchEffectiveUser();
  }, [user, tenant]);

  // Handle success/canceled from Stripe redirect
  useEffect(() => {
    if (toastShownRef.current) return;

    const savedMessage = localStorage.getItem("profile_message");
    if (savedMessage) {
      try {
        const msg = JSON.parse(savedMessage);
        if (msg.type === "success") {
          toast.success(msg.text, { toastId: "profile-success" });
        } else {
          toast.error(msg.text, { toastId: "profile-error" });
        }
        toastShownRef.current = true;
        localStorage.removeItem("profile_message");
      } catch {
        localStorage.removeItem("profile_message");
      }
      window.history.replaceState({}, "", "/profile");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const success = searchParams.get("success") || urlParams.get("success");
    const canceled = searchParams.get("canceled") || urlParams.get("canceled");

    if (success === "true") {
      toast.success(
        "Pagamento realizado com sucesso! Seu plano foi atualizado.",
        { toastId: "stripe-success" }
      );
      toastShownRef.current = true;
      window.history.replaceState({}, "", "/profile");
    } else if (canceled === "true") {
      toast.error("Pagamento cancelado. Nenhuma alteração foi feita.", {
        toastId: "stripe-canceled",
      });
      toastShownRef.current = true;
      window.history.replaceState({}, "", "/profile");
    }
  }, [searchParams]);

  // Load plans based on effective user
  useEffect(() => {
    const loadPlans = async () => {
      // Wait for effectiveUser to be determined
      if (!effectiveUser) return;

      try {
        const plans = await PlanService.getPlans();
        setAllPlans(plans);

        // Use effectiveUser's plan if available
        const targetPlanId = effectiveUser?.planId;
        if (targetPlanId) {
          const plan = await PlanService.getPlanById(targetPlanId);
          setUserPlan(plan);
        } else {
          // Don't default to starter - leave null if no plan assigned
          // This prevents flash when user's data is still loading
          setUserPlan(null);
        }
      } catch (error) {
        console.error("Error loading plans:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlans();
  }, [effectiveUser]);

  const isCurrentPlan = (plan: UserPlan) => {
    // Check if plan tier matches AND billing interval matches
    // If user has no billingInterval set (legacy), default to monthly
    const userInterval = effectiveUser?.billingInterval || "monthly";
    return userPlan?.tier === plan.tier && userInterval === billingInterval;
  };

  const canUpgrade = useCallback(
    (plan: UserPlan) => {
      if (!userPlan) return true;

      if (plan.order > userPlan.order) return true;
      if (plan.order < userPlan.order) return false;

      // Same tier: check billing interval
      // If user is Monthly and viewing Yearly -> Upgrade
      const currentInterval = effectiveUser?.billingInterval || "monthly";
      if (currentInterval === "monthly" && billingInterval === "yearly") {
        return true;
      }

      return false;
    },
    [userPlan, effectiveUser, billingInterval]
  );

  const showPlanChangeConfirmation = async (plan: UserPlan) => {
    if (!effectiveUser) return;

    setSelectedPlan(plan);
    setLoadingPreview(true);
    setDialogOpen(true);

    try {
      // Check if effective user has an existing Stripe subscription
      const hasSubscription = !!effectiveUser.stripeSubscriptionId;

      if (!hasSubscription) {
        // First subscription - no preview needed, redirect to checkout
        setIsFirstSubscription(true);
        setPlanPreview(null);
      } else {
        // User has a subscription, get proration preview
        setIsFirstSubscription(false);

        const { StripeService } = await import("@/services/stripe-service");
        const data = await StripeService.getPreview({
          userId: effectiveUser.id,
          newPlanTier: plan.tier,
          billingInterval: billingInterval,
        });

        if (data.preview) {
          setPlanPreview(data.preview as unknown as PlanPreview);
        } else if (data.isNewSubscription) {
          setIsFirstSubscription(true);
          setPlanPreview(null);
        } else {
          setIsFirstSubscription(true);
          setPlanPreview(null);
        }
      }
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("Erro ao carregar prévia. Tente novamente.");
      setDialogOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUpgrade = (plan: UserPlan) => {
    showPlanChangeConfirmation(plan);
  };

  const handleDowngrade = (plan: UserPlan) => {
    showPlanChangeConfirmation(plan);
  };

  const confirmPlanChange = async () => {
    if (!effectiveUser || !selectedPlan) return;

    const isUpgrade = planPreview?.isUpgrade ?? true;

    if (isUpgrade) {
      setUpgradingPlan(selectedPlan.tier);
    } else {
      setDowngradingPlan(selectedPlan.tier);
    }
    setDialogOpen(false);

    try {
      const { StripeService } = await import("@/services/stripe-service");
      const data = await StripeService.createCheckout({
        userId: effectiveUser.id,
        planTier: selectedPlan.tier,
        userEmail: effectiveUser.email,
        billingInterval: billingInterval,
        origin: window.location.origin,
      });

      if (data.url) {
        window.location.href = data.url;
      } else if (data.success) {
        localStorage.setItem(
          "profile_message",
          JSON.stringify({
            type: "success",
            text: "Plano atualizado com sucesso!",
          })
        );
        window.location.reload();
      } else {
        throw new Error("Falha ao processar");
      }
    } catch (error) {
      console.error("Plan change error:", error);
      toast.error("Erro ao processar alteração de plano. Tente novamente.");
      setUpgradingPlan(null);
      setDowngradingPlan(null);
    }
  };

  const handleManagePayment = async () => {
    if (!effectiveUser) return;

    setOpeningPortal(true);

    try {
      const { StripeService } = await import("@/services/stripe-service");
      const data = await StripeService.createPortalSession({
        userId: effectiveUser.id,
        origin: window.location.origin,
      });

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Falha ao abrir portal");
      }
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Erro ao abrir gerenciamento de pagamento.");
      setOpeningPortal(false);
    }
  };

  return {
    effectiveUser,
    userPlan,
    allPlans,
    isLoading,
    billingInterval,
    setBillingInterval,
    dialogOpen,
    selectedPlan,
    planPreview,
    loadingPreview,
    isFirstSubscription,
    upgradingPlan,
    downgradingPlan,
    openingPortal,
    handleUpgrade,
    handleDowngrade,
    confirmPlanChange,
    handleManagePayment,
    setDialogOpen,
    isCurrentPlan,
    canUpgrade,
  };
}
