"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import {
  getNotificationScopeKey,
  resolveNotificationScope,
} from "@/lib/notifications/scope";

export function useNotificationScope() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useMemo(() => {
    const scope = resolveNotificationScope({
      pathname,
      userRole: user?.role,
      userTenantId: user?.tenantId,
      viewingTenantId: tenant?.id,
    });

    return {
      scope,
      scopeKey: getNotificationScopeKey(scope),
      isSuperAdminViewer:
        String(user?.role || "").trim().toLowerCase() === "superadmin",
    };
  }, [pathname, tenant?.id, user?.role, user?.tenantId]);
}
