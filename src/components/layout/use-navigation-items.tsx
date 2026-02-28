"use client";

import * as React from "react";

import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import {
  menuItems,
  type MenuItem,
} from "@/components/layout/navigation-config";

export function useNavigationItems(): { visibleMenuItems: MenuItem[] } {
  const { hasFinancial, hasKanban } = usePlanLimits();
  const { hasPermission, isMaster } = usePermissions();

  const visibleMenuItems = React.useMemo(() => {
    return menuItems.filter((item) => {
      if (item.requiresFinancial && !hasFinancial && !isMaster) return true;
      if (item.requiresEnterprise && !hasKanban && !isMaster) return true;

      if (isMaster) return true;

      if (item.pageId) {
        if (item.children) {
          const visibleChildren = item.children.filter(
            (child) => !child.masterOnly,
          );
          return visibleChildren.length > 0;
        }
        return hasPermission(item.pageId, "view");
      }

      return true;
    });
  }, [hasFinancial, hasKanban, isMaster, hasPermission]);

  return { visibleMenuItems };
}
