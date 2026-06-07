"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { Tenant } from "@/types";

interface DisplayTenant {
  tenant: Tenant | null;
  isLoading: boolean;
}

/**
 * Resolves the tenant document for *display-only* purposes (header, profile).
 *
 * The tenant-provider deliberately leaves `tenant` null for roles that must not
 * hydrate the ERP-shaped context (free users, and superadmins who are not
 * impersonating). Those screens still need to show the company name/logo, so we
 * read the tenant doc directly via the cached `TenantService.getTenantById`
 * without polluting the global tenant context.
 */
export function useDisplayTenant(): DisplayTenant {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const [fetched, setFetched] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (tenant || !user?.tenantId) {
      setFetched(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);

    const fetchTenant = async () => {
      try {
        const { TenantService } = await import("@/services/tenant-service");
        const t = await TenantService.getTenantById(user.tenantId!);
        if (isActive) {
          setFetched(t || null);
        }
      } catch (error) {
        console.error("Error fetching display tenant:", error);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void fetchTenant();

    return () => {
      isActive = false;
    };
  }, [tenant, user?.tenantId]);

  return { tenant: tenant ?? fetched, isLoading };
}
