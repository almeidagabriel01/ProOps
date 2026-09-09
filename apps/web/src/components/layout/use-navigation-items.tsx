"use client";

import * as React from "react";

import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import {
  filterVisibleChildren,
  menuItems,
  type MenuItem,
  type SubMenuItem,
} from "@/components/layout/navigation-config";
import {
  getSolutionsPageConfig,
  isPageEnabledForNiche,
} from "@/lib/niches/config";

export function useNavigationItems(): { visibleMenuItems: MenuItem[] } {
  const { hasPermission, isMaster } = usePermissions();
  const { tenant, isDemo } = useTenant();

  const visibleMenuItems = React.useMemo(() => {
    const solutionsConfig = getSolutionsPageConfig(tenant?.niche);
    const viewer = {
      isMaster,
      isDemo,
      hasPermission,
      isPageEnabled: (pageId?: string | null) =>
        isPageEnabledForNiche(tenant?.niche, pageId),
    };

    const filterChildren = (item: MenuItem): SubMenuItem[] =>
      filterVisibleChildren(item, viewer)
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

        // Conta demo/free não tem documento de permissão, e precisa navegar o
        // menu inteiro para conhecer o produto: módulo do Starter navegável,
        // premium coroado.
        if (isMaster || isDemo) return true;

        // Grupo antes de folha: um grupo existe enquanto sobrar filho, e não
        // tem pageId próprio para consultar.
        if (item.children) return filterChildren(item).length > 0;
        // PERMISSÃO ANTES DE PLANO, como em filterChildren: sem a permissão o
        // item some em qualquer tier. Com ela, item sem o plano permanece e a
        // dock o coroa.
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
  }, [isMaster, isDemo, hasPermission, tenant?.niche]);

  return { visibleMenuItems };
}
