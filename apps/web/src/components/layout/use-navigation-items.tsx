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
import {
  BOT_WHATSAPP_DIGITS,
  buildWhatsAppHref,
} from "@/lib/whatsapp-contacts";

// Item da dock aponta para o BOT (assistente), não para o suporte.
const WHATSAPP_HREF = buildWhatsAppHref(BOT_WHATSAPP_DIGITS);

export function useNavigationItems(): { visibleMenuItems: MenuItem[] } {
  const { hasFinancial, hasKanban, hasWhatsApp } = usePlanLimits();
  const { hasPermission, isMaster } = usePermissions();
  const { tenant, isDemo } = useTenant();

  const visibleMenuItems = React.useMemo(() => {
    const solutionsConfig = getSolutionsPageConfig(tenant?.niche);

    return menuItems
      .map((item) => {
        // Update /solutions label dynamically based on niche config
        if (item.href === "/solutions" && item.pageId === "solutions") {
          return { ...item, label: solutionsConfig.navigationLabel };
        }
        // Resolve WhatsApp href from env (build-time inlined NEXT_PUBLIC_*)
        if (item.pageId === "whatsapp" && item.external) {
          return { ...item, href: WHATSAPP_HREF };
        }
        return item;
      })
      .filter((item) => {
        // External items (e.g. WhatsApp wa.me link) require a resolved href.
        if (item.external && !item.href) return false;
        return true;
      })
      .filter((item) => {
        // WhatsApp is hidden entirely for tenants without whatsappEnabled.
        if (item.requiresWhatsApp && !hasWhatsApp) return false;

        // Use availabilityPageId (if set) for niche availability checks,
        // falling back to pageId. This allows /ambientes and /solutions to
        // share pageId="solutions" for permissions but have separate niche gates.
        const availKey = item.availabilityPageId ?? item.pageId;
        if (!isPageEnabledForNiche(tenant?.niche, availKey)) return false;
        if (item.requiresFinancial && !hasFinancial && !isMaster) return true;
        if (item.requiresEnterprise && !hasKanban && !isMaster) return true;

        // Demo/free accounts have no permissions doc, but must see the whole
        // menu to browse: Starter modules navigable + premium ones crowned
        // (the premium early-returns above already flagged those).
        if (isMaster || isDemo) return true;

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
  }, [hasFinancial, hasKanban, hasWhatsApp, isMaster, isDemo, hasPermission, tenant?.niche]);

  return { visibleMenuItems };
}
