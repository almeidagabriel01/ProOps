"use client";

import * as React from "react";

import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import {
  menuItems,
  type MenuItem,
} from "@/components/layout/navigation-config";
import { isPageEnabledForNiche } from "@/lib/niches/config";

export function useNavigationItems(): { visibleMenuItems: MenuItem[] } {
  const { hasFinancial, hasKanban } = usePlanLimits();
  const { hasPermission, isMaster } = usePermissions();
  const { tenant } = useTenant();

  const visibleMenuItems = React.useMemo(() => {
    return menuItems.filter((item) => {
      if (!isPageEnabledForNiche(tenant?.niche, item.pageId)) return false;
      if (item.requiresFinancial && !hasFinancial && !isMaster) return true;
      if (item.requiresEnterprise && !hasKanban && !isMaster) return true;

      if (isMaster) return true;

      if (item.pageId) {
        if (item.children) {
          const visibleChildren = item.children.filter((child) => {
            if (!isPageEnabledForNiche(tenant?.niche, child.pageId)) {
              return false;
            }
            if (child.masterOnly && !isMaster) return false;
            if (child.pageId && !isMaster) {
              return hasPermission(child.pageId, "view");
            }
            return true;
          });
          return visibleChildren.length > 0;
        }
        return hasPermission(item.pageId, "view");
      }

      return true;
    });
  }, [hasFinancial, hasKanban, isMaster, hasPermission, tenant?.niche]);

  return { visibleMenuItems };
}
