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
export function useNavigationItems(): { visibleMenuItems: MenuItem[] } {
  const { hasFinancial, hasKanban, hasFiscal } = usePlanLimits();
  const capabilities = React.useMemo(
    () => ({ financial: hasFinancial, crm: hasKanban, fiscal: hasFiscal }),
    [hasFinancial, hasKanban, hasFiscal],
  );
  const { hasPermission, isMaster } = usePermissions();
  const { tenant, isDemo } = useTenant();

  const visibleMenuItems = React.useMemo(() => {
    const solutionsConfig = getSolutionsPageConfig(tenant?.niche);

    const filterChildren = (item: MenuItem): SubMenuItem[] =>
      (item.children ?? [])
        .filter((child) => {
          // availabilityPageId, não pageId: Ambientes divide "solutions" com
          // Soluções para a permissão, mas tem porta de nicho própria. Checando
          // por pageId, os dois sumiriam no nicho cortinas.
          const availKey = child.availabilityPageId ?? child.pageId;
          if (!isPageEnabledForNiche(tenant?.niche, availKey)) return false;
          if (child.masterOnly && !isMaster) return false;
          // Filho com capacidade própria (Notas Fiscais) permanece visível e
          // coroado, como o pai faz: some só por permissão ou nicho.
          if (
            child.requiresCapability &&
            !capabilities[child.requiresCapability]
          ) {
            return true;
          }
          if (child.pageId && !isMaster && !isDemo) {
            return hasPermission(child.pageId, "view");
          }
          return true;
        })
        // O rótulo de /solutions vem do nicho. Mora aqui, e não no map de nível
        // superior, porque Soluções é filho do Catálogo.
        .map((child) =>
          child.href === "/solutions"
            ? { ...child, label: solutionsConfig.navigationLabel }
            : child,
        );

    return menuItems
      .filter((item) => {
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

        // Grupo antes de folha: um grupo existe enquanto sobrar filho, e não
        // tem pageId próprio para consultar.
        if (item.children) return filterChildren(item).length > 0;
        if (item.pageId) return hasPermission(item.pageId, "view");

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
  }, [capabilities, isMaster, isDemo, hasPermission, tenant?.niche]);

  return { visibleMenuItems };
}
