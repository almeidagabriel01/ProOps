"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Crown } from "lucide-react";

import {
  resolveCapabilityRestriction,
  useMenuCapabilities,
} from "@/components/layout/capability-gate";
import {
  useActiveGroup,
  type DockEntryView,
} from "@/components/layout/use-dock-entries";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { useThemePrimaryColor } from "@/hooks/useThemePrimaryColor";
import { cn } from "@/lib/utils";

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

  if (!group) return null;

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

    router.push(href);
  };

  return (
    <>
      {/*
        Quatro visões com rótulos longos passam da largura de um telefone de
        360px. Rola na horizontal, sangrando até a borda do <main> (que tem p-4
        no celular), em vez de encolher o rótulo: ícone sozinho não distingue
        "Lançamentos" de "Comissões".
      */}
      <div
        className={cn(
          "-mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 md:pb-0",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          className,
        )}
      >
        <SegmentedControl
          id={`Visões de ${group.label}`}
          value={group.activeHref ?? group.views[0].href}
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
