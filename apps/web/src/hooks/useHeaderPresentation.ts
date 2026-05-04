"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { getImmediatePlanLabel, resolvePlanLabel } from "@/lib/plans/plan-label";
import { Tenant } from "@/types";

interface HeaderPresentation {
  companyName: string;
  planLabel: string;
  logoUrl?: string;
  avatarSeed: string;
  isViewingAsTenant: boolean;
  isPlanLabelLoading: boolean;
}

export function useHeaderPresentation(): HeaderPresentation {
  const { user } = useAuth();
  const { tenant, tenantOwner, tenantOwnerPlanName } = useTenant();

  const isViewingAsTenant = user?.role === "superadmin" && !!tenant;
  const isMember = user?.role === "member" || !!user?.masterId;

  const [fetchedTenant, setFetchedTenant] = useState<Tenant | null>(null);
  const [isFetchingTenant, setIsFetchingTenant] = useState(false);

  useEffect(() => {
    // Only fetch for superadmin when they are NOT impersonating
    if (user?.role === "superadmin" && !tenant && user.tenantId) {
      let isActive = true;
      setIsFetchingTenant(true);
      const fetchSuperAdminTenant = async () => {
        try {
          const { TenantService } = await import("@/services/tenant-service");
          const t = await TenantService.getTenantById(user.tenantId!);
          if (isActive) {
            setFetchedTenant(t || null);
          }
        } catch (error) {
          console.error("Error fetching superadmin tenant:", error);
        } finally {
          if (isActive) {
            setIsFetchingTenant(false);
          }
        }
      };
      
      void fetchSuperAdminTenant();
      
      return () => {
        isActive = false;
      };
    }
  }, [user?.role, user?.tenantId, tenant]);

  const companyName = useMemo(() => {
    if (isViewingAsTenant) {
      return tenant?.name || "Empresa sem nome";
    }

    if (user?.role === "superadmin" && !tenant) {
      if (isFetchingTenant) return "Carregando...";
      // Fallback: Use fetched tenant if it exists, otherwise use user's name (which for superadmins acts as the company/franchise name)
      return fetchedTenant?.name || user?.name || "Minha Empresa";
    }

    return tenant?.name || "Minha Empresa";
  }, [isViewingAsTenant, user?.role, tenant, fetchedTenant?.name, isFetchingTenant, user?.name]);

  const planSubject = useMemo(() => {
    if (isViewingAsTenant && tenantOwner) {
      return tenantOwner;
    }

    if (isMember && tenantOwner) {
      return tenantOwner;
    }

    // For regular admins, prefer tenantOwner (fetched from Firestore with planId)
    // over the auth-provided user which may lack the planId field
    if (tenantOwner?.planId) {
      return tenantOwner;
    }

    return user;
  }, [isMember, isViewingAsTenant, tenantOwner, user]);

  const presentationKey = useMemo(() => {
    return [
      user?.id || "anon",
      tenant?.id || "system",
      isViewingAsTenant ? "impersonating" : "default",
      planSubject?.id || "no-subject",
      planSubject?.planId || "no-plan",
      tenantOwnerPlanName || "no-plan-name",
    ].join(":");
  }, [
    isViewingAsTenant,
    planSubject?.id,
    planSubject?.planId,
    tenant?.id,
    tenantOwnerPlanName,
    user?.id,
  ]);

  const [resolvedPlanState, setResolvedPlanState] = useState<{
    key: string;
    label: string | null;
    status: "loading" | "resolved";
  } | null>(null);
  const immediatePlanLabel = useMemo(
    () =>
      getImmediatePlanLabel({
        role: planSubject?.role,
        planId: planSubject?.planId,
        preferredLabel: isViewingAsTenant ? tenantOwnerPlanName : null,
      }),
    [isViewingAsTenant, planSubject?.planId, planSubject?.role, tenantOwnerPlanName],
  );
  const resolvedPlanForKey =
    resolvedPlanState?.key === presentationKey ? resolvedPlanState : null;
  const needsAsyncResolution =
    !tenantOwnerPlanName &&
    !!planSubject?.planId &&
    !immediatePlanLabel;
  const visiblePlanLabel =
    resolvedPlanForKey?.status === "resolved"
      ? resolvedPlanForKey.label || "Sem Plano"
      : immediatePlanLabel || "Sem Plano";
  const isPlanLabelLoading =
    needsAsyncResolution && resolvedPlanForKey?.status !== "resolved";

  useEffect(() => {
    if (!needsAsyncResolution) {
      return;
    }

    let isActive = true;
    setResolvedPlanState((currentState) => {
      if (currentState?.key === presentationKey && currentState.status === "resolved") {
        return currentState;
      }

      return {
        key: presentationKey,
        label: null,
        status: "loading",
      };
    });

    void resolvePlanLabel(planSubject?.planId)
      .catch(() => null)
      .then((resolvedLabel) => {
        if (!isActive) {
          return;
        }

        setResolvedPlanState({
          key: presentationKey,
          label: resolvedLabel || null,
          status: "resolved",
        });
      });

    return () => {
      isActive = false;
    };
  }, [
    isViewingAsTenant,
    planSubject?.planId,
    planSubject?.role,
    presentationKey,
    immediatePlanLabel,
    needsAsyncResolution,
    tenantOwnerPlanName,
  ]);

  return {
    companyName,
    planLabel: visiblePlanLabel,
    logoUrl: tenant?.logoUrl || fetchedTenant?.logoUrl,
    avatarSeed: tenant?.name || fetchedTenant?.name || user?.name || "U",
    isViewingAsTenant,
    isPlanLabelLoading,
  };
}
