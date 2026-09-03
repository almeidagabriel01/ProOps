"use client";

import * as React from "react";

import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import {
  menuItems,
  type MenuItem,
  type SubMenuItem,
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
  const { hasFinancial, hasKanban, hasFiscal, hasWhatsApp } = usePlanLimits();
  const capabilities = React.useMemo(
    () => ({ financial: hasFinancial, crm: hasKanban, fiscal: hasFiscal }),
    [hasFinancial, hasKanban, hasFiscal],
  );
  const { hasPermission, isMaster } = usePermissions();
  const { tenant, isDemo } = useTenant();

  const visibleMenuItems = React.useMemo(() => {
    const solutionsConfig = getSolutionsPageConfig(tenant?.niche);

    const filterChildren = (item: MenuItem): SubMenuItem[] =>
      (item.children ?? []).filter((child) => {
        if (!isPageEnabledForNiche(tenant?.niche, child.pageId)) return false;
        if (child.masterOnly && !isMaster) return false;
        // Filho com capacidade própria (Notas Fiscais) permanece visível e
        // coroado, como o pai faz — some só por permissão ou nicho.
        if (child.requiresCapability && !capabilities[child.requiresCapability]) {
          return true;
        }
        if (child.pageId && !isMaster && !isDemo) {
          return hasPermission(child.pageId, "view");
        }
        return true;
      });

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
        if (
          item.requiresCapability &&
          !capabilities[item.requiresCapability] &&
          !isMaster
        ) {
          return true;
        }

        // Demo/free accounts have no permissions doc, but must see the whole
        // menu to browse: Starter modules navigable + premium ones crowned
        // (the premium early-returns above already flagged those).
        if (isMaster || isDemo) return true;

        if (item.pageId) {
          if (item.children) {
            return filterChildren(item).length > 0;
          }
          return hasPermission(item.pageId, "view");
        }

        return true;
      })
      // Devolve o item com os filhos JÁ filtrados. Antes voltava o item
      // original, e quem achata o grupo Financeiro na dock
      // (`use-dock-entries`) reaplicava só `masterOnly` — então "Notas
      // Fiscais" aparecia para quem tinha apenas `transactions.canView`, e
      // clicar levava sempre a /403. Filtrar em dois lugares com critérios
      // diferentes era a causa; agora só existe um.
      .map((item) =>
        item.children ? { ...item, children: filterChildren(item) } : item,
      );
  }, [capabilities, hasWhatsApp, isMaster, isDemo, hasPermission, tenant?.niche]);

  return { visibleMenuItems };
}
