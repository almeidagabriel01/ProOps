"use client";

import * as React from "react";

import {
  resolveGroupTarget,
  type MenuCapability,
  type MenuItem,
} from "@/components/layout/navigation-config";
import { useMenuCapabilities } from "@/components/layout/capability-gate";
import { useNavigationItems } from "@/components/layout/use-navigation-items";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";

/** Uma das visões de um grupo, como o seletor de cabeçalho as desenha. */
export type DockEntryView = {
  icon: MenuItem["icon"];
  label: string;
  href: string;
  requiresCapability?: MenuCapability;
};

export type DockEntry = {
  icon: MenuItem["icon"];
  label: string;
  href: string;
  requiresCapability?: MenuCapability;
  /** Link externo (wa.me): renderiza <a target="_blank"> em vez de <Link>. */
  external?: boolean;
  /**
   * Todas as rotas que este ícone representa. Sem isto o ícone do Financeiro
   * não acenderia em /wallets, que é destino dele mas não o href dele.
   */
  matchHrefs?: string[];
  /** As visões do grupo, na ordem do menu. Ausente em item solto. */
  views?: DockEntryView[];
};

/**
 * O modelo de navegação compartilhado pela dock, pela tab bar do celular e pelo
 * seletor de visão das páginas.
 *
 * As três superfícies têm que oferecer os mesmos destinos sob o mesmo gate de
 * plano, permissão e nicho, então o colapso mora aqui em vez de ser duplicado
 * por superfície. `useNavigationItems` já aplicou o gate.
 *
 * Um GRUPO vira um ícone só. O destino não é fixo: quem o resolve é
 * `resolveGroupTarget`, porque um membro pode ter permissão apenas para o
 * segundo filho. Sobrando um filho só, a entry vira o próprio filho: um ícone
 * rotulado "Financeiro" que leva a /wallets mentiria sobre o destino, e o
 * seletor de visão não desenha nada com uma opção.
 */
export function useDockEntries(): DockEntry[] {
  const { visibleMenuItems } = useNavigationItems();
  const capabilities = useMenuCapabilities();
  const { isLoading: isPlanLoading } = usePlanLimits();
  const { isLoading: arePermissionsLoading } = usePermissions();

  return React.useMemo(() => {
    // Enquanto carrega, o PlanProvider devolve toda capacidade como false e o
    // PermissionsProvider nega tudo. Antes isso só piscava coroa; com grupo,
    // decidiria também PARA ONDE o ícone aponta, e um clique rápido iria para a
    // página errada. Melhor não desenhar nada do que desenhar errado.
    if (isPlanLoading || arePermissionsLoading) return [];

    const entries: DockEntry[] = [];

    for (const item of visibleMenuItems) {
      if (item.children) {
        const children = item.children;
        const target = resolveGroupTarget(item, children, capabilities);
        if (!target) continue;

        const views: DockEntryView[] = children.map((child) => ({
          icon: child.icon,
          label: child.label,
          href: child.href,
          requiresCapability: child.requiresCapability ?? item.requiresCapability,
        }));

        if (views.length === 1) {
          entries.push({ ...views[0], matchHrefs: [views[0].href] });
          continue;
        }

        entries.push({
          icon: item.icon,
          label: item.label,
          href: target.href,
          requiresCapability: target.requiresCapability,
          matchHrefs: views.map((view) => view.href),
          views,
        });
        continue;
      }

      if (!item.href) continue;
      entries.push({
        icon: item.icon,
        label: item.label,
        href: item.href,
        external: item.external,
        requiresCapability: item.requiresCapability,
      });
    }

    return entries;
  }, [visibleMenuItems, capabilities, isPlanLoading, arePermissionsLoading]);
}

/**
 * Prefixo mais longo do pathname contra as rotas de cada entry, devolvendo o
 * href da ENTRY. É por isso que /transactions/123 acende o Financeiro, e também
 * /wallets, que é visão do mesmo grupo.
 */
export function useActiveEntryHref(
  entries: DockEntry[],
  pathname: string,
): string | null {
  return React.useMemo(() => {
    let best: { entryHref: string; length: number } | null = null;

    for (const entry of entries) {
      for (const candidate of entry.matchHrefs ?? [entry.href]) {
        const matches =
          pathname === candidate || pathname.startsWith(candidate + "/");
        if (!matches) continue;
        if (!best || candidate.length > best.length) {
          best = { entryHref: entry.href, length: candidate.length };
        }
      }
    }

    return best?.entryHref ?? null;
  }, [entries, pathname]);
}

/**
 * O grupo a que a rota atual pertence, para o seletor de visão do cabeçalho.
 *
 * Deriva de `useDockEntries`, ou seja do MESMO array que a dock renderiza: o
 * seletor não é uma quinta lista de navegação que poderia divergir das outras
 * quatro, é a mesma computação vista de outro ângulo.
 */
export function useActiveGroup(pathname: string): {
  label: string;
  views: DockEntryView[];
  activeHref: string | null;
} | null {
  const entries = useDockEntries();

  return React.useMemo(() => {
    let best: { entry: DockEntry; href: string; length: number } | null = null;

    for (const entry of entries) {
      if (!entry.views || entry.views.length < 2) continue;
      for (const candidate of entry.matchHrefs ?? []) {
        const matches =
          pathname === candidate || pathname.startsWith(candidate + "/");
        if (!matches) continue;
        if (!best || candidate.length > best.length) {
          best = { entry, href: candidate, length: candidate.length };
        }
      }
    }

    if (!best) return null;
    return {
      label: best.entry.label,
      views: best.entry.views!,
      activeHref: best.href,
    };
  }, [entries, pathname]);
}
