"use client";

import * as React from "react";

import {
  getVisibleChildren,
  type MenuCapability,
  type MenuItem,
} from "@/components/layout/navigation-config";
import { useNavigationItems } from "@/components/layout/use-navigation-items";
import { usePermissions } from "@/providers/permissions-provider";

export type DockEntry = {
  icon: MenuItem["icon"];
  label: string;
  href: string;
  external?: boolean;
  requiresCapability?: MenuCapability;
  pageId?: string;
};

/**
 * The flat navigation model shared by the desktop dock and the mobile tab bar.
 *
 * Both surfaces must offer the exact same destinations under the exact same
 * plan/permission/niche gating, so the flattening lives here instead of being
 * duplicated per surface. `useNavigationItems` already applies the gating.
 */
export function useDockEntries(): DockEntry[] {
  const { visibleMenuItems } = useNavigationItems();
  const { isMaster } = usePermissions();

  return React.useMemo(() => {
    const entries: DockEntry[] = [];

    for (const item of visibleMenuItems) {
      const children = item.children ? getVisibleChildren(item, isMaster) : [];

      // Achatar o Financeiro: remover item pai e inserir os filhos como itens diretos.
      if (
        (item.href === "/transactions" || item.label === "Financeiro") &&
        children.length > 0
      ) {
        for (const child of children) {
          entries.push({
            icon: child.icon,
            label: child.label,
            href: child.href,
            // O filho pode exigir MAIS que o pai: Notas Fiscais é Enterprise
            // enquanto o grupo Financeiro é Pro. Herdar sempre a do pai fazia
            // um assinante Pro ver "Notas Fiscais" liberado.
            requiresCapability: child.requiresCapability ?? item.requiresCapability,
            pageId: item.pageId,
          });
        }
        continue;
      }

      entries.push({
        icon: item.icon,
        label: item.label,
        href: item.href,
        external: item.external,
        requiresCapability: item.requiresCapability,
        pageId: item.pageId,
      });
    }

    return entries;
  }, [visibleMenuItems, isMaster]);
}

/**
 * Longest-prefix match of the current pathname against the entry list, so
 * `/transactions/123` still highlights `/transactions`.
 */
export function useActiveEntryHref(
  entries: DockEntry[],
  pathname: string,
): string | null {
  return React.useMemo(() => {
    let best: string | null = null;
    for (const entry of entries) {
      const matches =
        pathname === entry.href || pathname.startsWith(entry.href + "/");
      if (!matches) continue;
      if (!best || entry.href.length > best.length) best = entry.href;
    }
    return best;
  }, [entries, pathname]);
}
