"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from '@/lib/toast';
import { UserPlan, User, Tenant, BillingInterval } from "@/types";
import { PlanPreview } from "@/types/plan";
import { PlanService } from "@/services/plan-service";
import { trackActivity } from "@/lib/activity/activity-tracker";
import { isManualContractWithoutStripe } from "@/lib/billing/manual-contract";

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
  handleUpgrade: (plan: UserPlan, skipTrial?: boolean) => void;
  handleDowngrade: (plan: UserPlan) => void;
  confirmPlanChange: () => Promise<void>;
  handleManagePayment: () => Promise<void>;
  setDialogOpen: (open: boolean) => void;

  // Helpers
  isCurrentPlan: (plan: UserPlan) => boolean;
  canUpgrade: (plan: UserPlan) => boolean;
  /** Plano dado pelo superadmin, sem assinatura no Stripe: todo card assina. */
  isManualContract: boolean;
}

export function usePlanChange(
  user: User | null,
  tenant?: Tenant | null,
  /**
   * Conta que carrega a assinatura, resolvida por `useProfileSubject`: a do
   * próprio usuário, ou a do dono da empresa vista pelo super admin.
   */
  billing?: { user: User | null; ready: boolean },
): UsePlanChangeReturn {
  const searchParams = useSearchParams();

  // Plan state
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [allPlans, setAllPlans] = useState<UserPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUser = billing ? billing.user : user;
  const effectiveUserReady = billing ? billing.ready : Boolean(user);

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
  // Pro plan only: when true, subscribe directly without the 7-day trial.
  const [skipTrial, setSkipTrial] = useState(false);
  const [planPreview, setPlanPreview] = useState<PlanPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isFirstSubscription, setIsFirstSubscription] = useState(false);

  const toastShownRef = useRef(false);

  const normalizePlanKey = useCallback((value?: string | null) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized || null;
  }, []);

  const resolvePlanFromCollection = useCallback(
    (plans: UserPlan[], candidates: Array<string | null | undefined>) => {
      const normalizedCandidates = candidates
        .map((candidate) => normalizePlanKey(candidate))
        .filter((candidate): candidate is string => Boolean(candidate));

      if (normalizedCandidates.length === 0) {
        return null;
      }

      return (
        plans.find((plan) => {
          const planKeys = [
            normalizePlanKey(plan.id),
            normalizePlanKey(plan.tier),
            normalizePlanKey(plan.name),
          ].filter((key): key is string => Boolean(key));

          return normalizedCandidates.some((candidate) =>
            planKeys.includes(candidate),
          );
        }) || null
      );
    },
    [normalizePlanKey],
  );

  // Handle success/canceled from Stripe redirect
  useEffect(() => {
    // Wait for loading to complete before showing toasts
    if (isLoading) return;
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
        { toastId: "stripe-success" },
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
  }, [searchParams, isLoading]);

  // Load plans based on effective user
  useEffect(() => {
    const loadPlans = async () => {
      // Espera saber de quem é a assinatura. Sem dono resolvido (empresa sem
      // dono), os planos carregam do mesmo jeito, só sem o plano atual.
      if (!effectiveUserReady) return;

      let storedPlan: UserPlan | null = null;

      try {
        const plans = await PlanService.getPlans();
        setAllPlans(plans);

        const targetPlanId = effectiveUser?.planId;
        if (targetPlanId) {
          storedPlan = await PlanService.getPlanById(targetPlanId);
        }

        const resolvedPlan =
          resolvePlanFromCollection(plans, [
            targetPlanId,
            storedPlan?.id,
            storedPlan?.tier,
            storedPlan?.name,
          ]) || storedPlan;

        setUserPlan(resolvedPlan);
      } catch (error) {
        console.error("Error loading plans:", error);
      }

      // Fetch live prices immediately to avoid stale data
      try {
        const livePlans = await PlanService.getLivePlans();
        if (livePlans && livePlans.length > 0) {
          setAllPlans(livePlans);

          const targetPlanId = effectiveUser?.planId;
          const liveUserPlan = resolvePlanFromCollection(livePlans, [
            targetPlanId,
            storedPlan?.id,
            storedPlan?.tier,
            storedPlan?.name,
          ]);

          if (liveUserPlan) {
            setUserPlan(liveUserPlan);
          }
        }
      } catch (error) {
        console.warn("Live price update failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlans();
  }, [effectiveUser, effectiveUserReady, resolvePlanFromCollection]);

  const isManualContract = isManualContractWithoutStripe(tenant, effectiveUser);

  const isCurrentPlan = (plan: UserPlan) => {
    // A free/demo account has no current PAID plan — never highlight one as
    // active (e.g. a leftover "starter" from a churned trial).
    if (String(effectiveUser?.role || "").toLowerCase() === "free") return false;
    if (isManualContract) return false;
    // Check if plan tier matches AND billing interval matches
    // If user has no billingInterval set (legacy), default to monthly
    const userInterval = effectiveUser?.billingInterval || "monthly";
    return userPlan?.tier === plan.tier && userInterval === billingInterval;
  };

  const canUpgrade = useCallback(
    (plan: UserPlan) => {
      if (!userPlan || isManualContract) return true;

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
    [userPlan, effectiveUser, billingInterval, isManualContract],
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

  const handleUpgrade = (plan: UserPlan, skip = false) => {
    trackActivity("subscribe_clicked", {
      meta: { source: "plan_card", plan: plan.tier, interval: billingInterval, skipTrial: skip },
    });
    setSkipTrial(skip);
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
        skipTrial,
      });

      if (data.url) {
        window.location.href = data.url;
      } else if (data.success) {
        localStorage.setItem(
          "profile_message",
          JSON.stringify({
            type: "success",
            text: "Plano atualizado com sucesso!",
          }),
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
    const isSuperAdminViewing = user?.role === "superadmin" && Boolean(tenant?.id);
    if (!isSuperAdminViewing && !effectiveUser) return;

    setOpeningPortal(true);

    try {
      const { StripeService } = await import("@/services/stripe-service");
      const data = await StripeService.createPortalSession({
        userId: effectiveUser?.id || "",
        origin: window.location.origin,
        ...(isSuperAdminViewing && tenant?.id && { targetTenantId: tenant.id }),
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
    isManualContract,
  };
}
