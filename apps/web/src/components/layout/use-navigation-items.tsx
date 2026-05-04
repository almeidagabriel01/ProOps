"use client";

import * as React from "react";

import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import {
  menuItems,
  type MenuItem,
} from "@/components/layout/navigation-config";
import {
  getSolutionsPageConfig,
  isPageEnabledForNiche,
} from "@/lib/niches/config";

export function useNavigationItems(): { visibleMenuItems: MenuItem[] } {
  const { hasFinancial, hasKanban } = usePlanLimits();
  const { hasPermission, isMaster } = usePermissions();
  const { tenant } = useTenant();

  const visibleMenuItems = React.useMemo(() => {
    const solutionsConfig = getSolutionsPageConfig(tenant?.niche);

    return menuItems
      .map((item) => {
        // Update /solutions label dynamically based on niche config
        if (item.href === "/solutions" && item.pageId === "solutions") {
          return { ...item, label: solutionsConfig.navigationLabel };
        }
        return item;
      })
      .filter((item) => {
        // Use availabilityPageId (if set) for niche availability checks,
        // falling back to pageId. This allows /ambientes and /solutions to
        // share pageId="solutions" for permissions but have separate niche gates.
        const availKey = item.availabilityPageId ?? item.pageId;
        if (!isPageEnabledForNiche(tenant?.niche, availKey)) return false;
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
