"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Crown } from "lucide-react";

import {
  resolveCapabilityRestriction,
  useMenuCapabilities,
} from "@/components/layout/capability-gate";
import { menuItems, type MenuItem } from "@/components/layout/navigation-config";
import {
  useActiveGroup,
  type DockEntryView,
} from "@/components/layout/use-dock-entries";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { useThemePrimaryColor } from "@/hooks/useThemePrimaryColor";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/providers/permissions-provider";

// Quem rola é a barra do `SegmentedControl`, que também centra a visão ativa e
// esmaece a borda com visões escondidas. O `contain` impede a fileira de impor
// a própria largura ao pai no celular: num cabeçalho em linha que quebra, o
// bloco do título crescia até ~700px (as sete visões do Financeiro) e a página
// de Notas Fiscais inteira rolava de lado.
const WRAPPER_CLASSES = "max-md:[contain:inline-size]";

/**
 * A rota é visão de um grupo do menu, antes de qualquer gate. Serve só para
 * reservar o lugar do seletor enquanto plano e permissões carregam.
 */
export function routeBelongsToGroup(
  pathname: string,
  items: MenuItem[] = menuItems,
): boolean {
  return items.some(
    (item) =>
      (item.children?.length ?? 0) >= 2 &&
      item.children!.some(
        (child) =>
          pathname === child.href || pathname.startsWith(child.href + "/"),
      ),
  );
}

/**
 * Alterna entre as telas de um grupo da navegação, no cabeçalho da página.
 *
 * A dock desenha um ícone por grupo; este seletor é o outro lado dessa moeda,
 * onde as telas irmãs voltam a aparecer. Ele NÃO recebe as visões por prop de
 * propósito: quem decide o que aparece é a navegação, não a página. Assim uma
 * tela não consegue oferecer uma visão que a pessoa não pode abrir, nem
 * esquecer de coroar uma que o plano não libera, e não existe uma quinta lista
 * de destinos para divergir das outras.
 *
 * O `SegmentedControl` usa `aria-pressed`, semântica de alternância, e aqui há
 * navegação de rota. É empréstimo consciente: a troca é imediata e o
 * `role="group"` carrega um rótulo que diz de qual módulo são as visões.
 */
interface PageViewSwitcherProps {
  className?: string;
}

export function PageViewSwitcher({ className }: PageViewSwitcherProps) {
  const pathname = usePathname();
  const router = useRouter();
  const capabilities = useMenuCapabilities();
  const upgradeModal = useUpgradeModal();
  const premiumColor = useThemePrimaryColor();
  const group = useActiveGroup(pathname);
  const { isLoading: isPlanLoading } = usePlanLimits();
  const { isLoading: arePermissionsLoading } = usePermissions();
  // A visão tocada acende na hora; a rota nova pode levar um instante para
  // abrir (loading.tsx), e sem isso o toque parecia não ter pegado.
  const [pending, setPending] = React.useState<{
    href: string;
    from: string;
  } | null>(null);

  if (!group) {
    // A navegação não desenha grupo enquanto plano e permissões carregam, e a
    // página costuma abrir antes disso. Sem reservar a altura, o seletor
    // chegava depois e empurrava a tela 52px para baixo (CLS no CI).
    if ((isPlanLoading || arePermissionsLoading) && routeBelongsToGroup(pathname)) {
      return (
        <div className={cn(WRAPPER_CLASSES, className)} aria-hidden="true">
          <div
            data-testid="page-view-switcher-placeholder"
            className="h-10 w-56 rounded-xl bg-muted/60 animate-pulse"
          />
        </div>
      );
    }
    return null;
  }

  const renderIcon = (view: DockEntryView) => {
    const { restricted } = resolveCapabilityRestriction(
      view.requiresCapability,
      capabilities,
    );

    if (!restricted) return <view.icon className="h-3.5 w-3.5" />;

    return (
      <span className="relative flex items-center">
        <view.icon className="h-3.5 w-3.5" style={{ color: premiumColor }} />
        <Crown
          className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5"
          style={{ color: premiumColor }}
        />
      </span>
    );
  };

  const handleChange = (href: string) => {
    const view = group.views.find((candidate) => candidate.href === href);
    if (!view) return;

    const { restricted, requiredPlan, description } =
      resolveCapabilityRestriction(view.requiresCapability, capabilities);

    // Mesmo desfecho do ícone bloqueado na dock: abre o upsell e não navega.
    if (restricted) {
      upgradeModal.showUpgradeModal(view.label, description, requiredPlan);
      return;
    }

    setPending({ href, from: pathname });
    router.push(href);
  };

  const activeHref =
    pending && pending.from === pathname
      ? pending.href
      : (group.activeHref ?? group.views[0].href);

  return (
    <>
      {/*
        Quatro visões com rótulos longos passam da largura de um telefone de
        360px. Rola na horizontal em vez de encolher o rótulo: ícone sozinho
        não distingue "Lançamentos" de "Comissões".
      */}
      <div className={cn(WRAPPER_CLASSES, className)}>
        <SegmentedControl
          id={`Visões de ${group.label}`}
          value={activeHref}
          onChange={handleChange}
          options={group.views.map((view) => ({
            value: view.href,
            label: view.label,
            icon: renderIcon(view),
          }))}
        />
      </div>

      <UpgradeModal
        open={upgradeModal.isOpen}
        onOpenChange={upgradeModal.setIsOpen}
        feature={upgradeModal.feature}
        description={upgradeModal.description}
        requiredPlan={upgradeModal.requiredPlan}
      />
    </>
  );
}
