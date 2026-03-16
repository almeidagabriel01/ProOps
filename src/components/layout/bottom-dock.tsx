"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, LogOut, MoveHorizontal } from "lucide-react";

import { Dock, DockIcon } from "@/components/ui/dock";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import {
  getVisibleChildren,
  lightenColor,
  MenuItem,
} from "@/components/layout/navigation-config";
import { useNavigationItems } from "@/components/layout/use-navigation-items";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { useAuth } from "@/providers/auth-provider";

const HOTZONE_HEIGHT_PX = 6;
const HIDE_DELAY_MS = 700;
const TOP_VISIBLE_THRESHOLD_PX = 0;
const SCROLL_CONTAINER_ID = "main-content";
const TOP_IDLE_AUTOHIDE_MS = 5_000;

function useHasHoverSupport() {
  const [hasHover, setHasHover] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(hover: hover)");
    const update = () => setHasHover(!!mql.matches);
    update();

    // Safari < 14
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyMql = mql as any;
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    if (typeof anyMql.addListener === "function") {
      anyMql.addListener(update);
      return () => anyMql.removeListener(update);
    }
  }, []);

  return hasHover;
}

function DockDivider() {
  return <div className="mx-1 h-6 w-px bg-black/10 dark:bg-white/15" />;
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mql.matches);
    update();

    // Safari < 14
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyMql = mql as any;
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    if (typeof anyMql.addListener === "function") {
      anyMql.addListener(update);
      return () => anyMql.removeListener(update);
    }
  }, []);

  return isMobile;
}

function DockItemContent({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label} delayMs={0}>
      {children}
    </Tooltip>
  );
}

type DockEntry = {
  icon: MenuItem["icon"];
  label: string;
  href: string;
  requiresFinancial?: boolean;
  requiresEnterprise?: boolean;
  pageId?: string;
};

export function BottomDock() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const { tenant } = useTenant();
  const { hasFinancial, hasKanban } = usePlanLimits();
  const { isMaster } = usePermissions();
  const upgradeModal = useUpgradeModal();

  const { visibleMenuItems } = useNavigationItems();

  const hasHover = useHasHoverSupport();
  const isMobile = useIsMobileViewport();

  const [isVisible, setIsVisible] = React.useState(true);
  const [isAtTop, setIsAtTop] = React.useState(true);
  const [isDockInteracting, setIsDockInteracting] = React.useState(false);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [showSwipeHint, setShowSwipeHint] = React.useState(true);
  const mobileScrollRef = React.useRef<HTMLDivElement | null>(null);
  const hideTimeoutRef = React.useRef<number | null>(null);
  const topIdleTimeoutRef = React.useRef<number | null>(null);

  const clearHideTimeout = React.useCallback(() => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const clearTopIdleTimeout = React.useCallback(() => {
    if (topIdleTimeoutRef.current) {
      window.clearTimeout(topIdleTimeoutRef.current);
      topIdleTimeoutRef.current = null;
    }
  }, []);

  const scheduleHide = React.useCallback(() => {
    if (!hasHover) return; // touch devices: keep it visible
    if (isAtTop) return;
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      hideTimeoutRef.current = null;
    }, HIDE_DELAY_MS);
  }, [clearHideTimeout, hasHover, isAtTop]);

  const showDock = React.useCallback(() => {
    clearHideTimeout();
    clearTopIdleTimeout();
    setIsVisible(true);
  }, [clearHideTimeout, clearTopIdleTimeout]);

  React.useEffect(() => {
    return () => {
      clearHideTimeout();
      clearTopIdleTimeout();
    };
  }, [clearHideTimeout, clearTopIdleTimeout]);

  // Regra de visibilidade por scroll:
  // - no topo absoluto: sempre visível
  // - rolou um pouco: oculta e só reaparece pelo hot zone no rodapé
  React.useEffect(() => {
    if (!hasHover) {
      setIsAtTop(true);
      setIsVisible(true);
      return;
    }

    const scrollEl = document.getElementById(SCROLL_CONTAINER_ID);
    const target: HTMLElement | Window = scrollEl ?? window;

    const getScrollTop = () => {
      if (target === window) return window.scrollY || 0;
      return (target as HTMLElement).scrollTop || 0;
    };

    const update = () => {
      const atTop = getScrollTop() <= TOP_VISIBLE_THRESHOLD_PX;
      setIsAtTop(atTop);
      if (atTop) {
        clearHideTimeout();
        setIsVisible(true);
      } else {
        // Rolou um pouco: oculta imediatamente (reaparece apenas pelo hot zone)
        clearTopIdleTimeout();
        setIsVisible(false);
      }
    };

    update();
    if (target === window) {
      window.addEventListener("scroll", update, { passive: true });
      return () => window.removeEventListener("scroll", update);
    }
    (target as HTMLElement).addEventListener("scroll", update, {
      passive: true,
    });
    return () => (target as HTMLElement).removeEventListener("scroll", update);
  }, [hasHover, clearHideTimeout, clearTopIdleTimeout]);

  // Mesmo no topo, se ficar "parado" por muito tempo, recolhe a dock.
  React.useEffect(() => {
    if (!hasHover) return;

    // Só aplica no topo e quando estiver visível
    if (!isAtTop || !isVisible) {
      clearTopIdleTimeout();
      return;
    }

    // Se estiver interagindo (mouse em cima/foco), não auto-oculta.
    if (isDockInteracting) {
      clearTopIdleTimeout();
      return;
    }

    clearTopIdleTimeout();
    topIdleTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      topIdleTimeoutRef.current = null;
    }, TOP_IDLE_AUTOHIDE_MS);

    return () => {
      clearTopIdleTimeout();
    };
  }, [hasHover, isAtTop, isVisible, isDockInteracting, clearTopIdleTimeout]);

  // Ao navegar e não estar no topo, já oculta.
  React.useEffect(() => {
    if (!hasHover) return;
    if (isAtTop) return;
    clearHideTimeout();
    setIsVisible(false);
  }, [pathname, hasHover, isAtTop, clearHideTimeout]);

  const isAdminPage = pathname.startsWith("/admin");

  const primaryColor = tenant?.primaryColor || "#2563eb";
  const premiumColor = lightenColor(primaryColor, 25);

  const dockEntries: DockEntry[] = React.useMemo(() => {
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
            requiresFinancial: item.requiresFinancial,
            pageId: item.pageId,
          });
        }
        continue;
      }

      entries.push({
        icon: item.icon,
        label: item.label,
        href: item.href,
        requiresFinancial: item.requiresFinancial,
        requiresEnterprise: item.requiresEnterprise,
        pageId: item.pageId,
      });
    }

    return entries.filter((entry) => entry.href !== "/spreadsheets");
  }, [visibleMenuItems, isMaster]);

  const activeHref = React.useMemo(() => {
    let best: string | null = null;
    for (const entry of dockEntries) {
      const matches =
        pathname === entry.href || pathname.startsWith(entry.href + "/");
      if (!matches) continue;
      if (!best || entry.href.length > best.length) best = entry.href;
    }
    return best;
  }, [dockEntries, pathname]);

  // Não mostrar dock no admin
  if (isAdminPage) {
    return null;
  }

  const renderMenuItem = (entry: DockEntry) => {
    const isFinancialRestricted = !!entry.requiresFinancial && !hasFinancial;
    const isEnterpriseRestricted = !!entry.requiresEnterprise && !hasKanban;
    const isRestricted = isFinancialRestricted || isEnterpriseRestricted;
    const active = !!activeHref && entry.href === activeHref;

    if (isRestricted) {
      return (
        <DockIcon
          key={entry.href}
          className={cn(
            "relative opacity-55 cursor-pointer",
            active &&
              "bg-primary/15 dark:bg-primary/20 ring-1 ring-primary/30 dark:ring-primary/20",
          )}
          data-active={active ? "true" : undefined}
          aria-label={entry.label}
        >
          <DockItemContent label={entry.label}>
            <button
              type="button"
              onClick={() =>
                upgradeModal.showUpgradeModal(
                  entry.label,
                  isEnterpriseRestricted
                    ? "Gerencie suas propostas e lançamentos com nosso CRM visual."
                    : "Controle suas finanças com nosso módulo completo.",
                  isEnterpriseRestricted ? "enterprise" : "pro",
                )
              }
              className="flex items-center justify-center w-full h-full cursor-pointer"
              aria-label={entry.label}
            >
              <entry.icon
                className="w-6 h-6 opacity-90"
                style={{ color: premiumColor }}
              />
            </button>
          </DockItemContent>
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-background/90 ring-1 ring-border/70">
            <Crown className="h-3 w-3" style={{ color: premiumColor }} />
          </span>
        </DockIcon>
      );
    }

    return (
      <DockIcon
        key={entry.href}
        aria-label={entry.label}
        className={cn(
          active &&
            "bg-primary/20 dark:bg-primary/25 ring-1 ring-primary/35 dark:ring-primary/25 shadow-sm transition-[background-color,box-shadow] duration-200 ease-out",
        )}
        data-active={active ? "true" : undefined}
      >
        <DockItemContent label={entry.label}>
          <Link
            href={entry.href}
            className={cn(
              "absolute inset-0 flex items-center justify-center",
              active
                ? "text-foreground"
                : "text-foreground/85 hover:text-foreground",
            )}
            aria-label={entry.label}
          >
            <entry.icon className="w-6 h-6" />
          </Link>
        </DockItemContent>
      </DockIcon>
    );
  };

  const renderMobileIconItem = (entry: DockEntry) => {
    const isFinancialRestricted = !!entry.requiresFinancial && !hasFinancial;
    const isEnterpriseRestricted = !!entry.requiresEnterprise && !hasKanban;
    const isRestricted = isFinancialRestricted || isEnterpriseRestricted;
    const active = !!activeHref && entry.href === activeHref;

    if (isRestricted) {
      return (
        <button
          key={entry.href}
          type="button"
          onClick={() =>
            upgradeModal.showUpgradeModal(
              entry.label,
              isEnterpriseRestricted
                ? "Gerencie suas propostas e lançamentos com nosso CRM visual."
                : "Controle suas finanças com nosso módulo completo.",
              isEnterpriseRestricted ? "enterprise" : "pro",
            )
          }
          className={cn(
            "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            active ? "bg-primary/15 text-foreground" : "text-foreground/80",
          )}
          aria-label={entry.label}
        >
          <entry.icon className="h-4 w-4" style={{ color: premiumColor }} />
          <Crown
            className="absolute -right-0.5 -top-0.5 h-3 w-3"
            style={{ color: premiumColor }}
          />
        </button>
      );
    }

    return (
      <Link
        key={entry.href}
        href={entry.href}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          active ? "bg-primary/15 text-foreground" : "text-foreground/80",
        )}
        aria-label={entry.label}
      >
        <entry.icon className="h-4 w-4" />
      </Link>
    );
  };

  const updateMobileScrollIndicators = React.useCallback(() => {
    const container = mobileScrollRef.current;
    if (!container) return;
    const left = container.scrollLeft > 8;
    const right =
      container.scrollLeft + container.clientWidth < container.scrollWidth - 8;
    setCanScrollLeft(left);
    setCanScrollRight(right);
  }, []);

  React.useEffect(() => {
    if (!isMobile) return;
    updateMobileScrollIndicators();
    const container = mobileScrollRef.current;
    if (!container) return;

    const onScroll = () => {
      updateMobileScrollIndicators();
      if (container.scrollLeft > 24) {
        setShowSwipeHint(false);
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateMobileScrollIndicators);
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateMobileScrollIndicators);
    };
  }, [isMobile, dockEntries.length, updateMobileScrollIndicators]);

  const shouldAutoHide = hasHover;

  if (isMobile) {
    return (
      <>
        <div className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-md rounded-2xl border border-white/20 bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur-sm">
            <div className="relative">
              {canScrollLeft && (
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-l-2xl bg-gradient-to-r from-background/95 to-transparent" />
              )}
              {canScrollRight && (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-2xl bg-gradient-to-l from-background/95 to-transparent" />
              )}

              <div
                ref={mobileScrollRef}
                className="scrollbar-none flex items-center gap-2 overflow-x-auto px-0.5 py-0.5"
              >
                {dockEntries.map(renderMobileIconItem)}
                <button
                  type="button"
                  onClick={logout}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-destructive"
                  aria-label="Sair"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showSwipeHint && canScrollRight && (
              <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <MoveHorizontal className="h-3 w-3" />
                <span>Arraste para ver mais atalhos</span>
              </div>
            )}
          </div>
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

  return (
    <>
      {/* Hot zone no limite inferior: ao encostar o mouse aqui, a dock reaparece */}
      {shouldAutoHide && (
        <div
          className="fixed left-0 right-0 bottom-0 z-30"
          style={{ height: HOTZONE_HEIGHT_PX }}
          onMouseEnter={showDock}
          onMouseMove={showDock}
        />
      )}

      <div
        className={cn(
          "fixed left-1/2 bottom-4 -translate-x-1/2 z-40",
          "transition-transform duration-300 ease-out",
          isVisible ? "translate-y-0" : "translate-y-[calc(100%+24px)]",
        )}
        onMouseEnter={() => {
          setIsDockInteracting(true);
          showDock();
        }}
        onMouseLeave={() => {
          setIsDockInteracting(false);
          scheduleHide();
        }}
        onFocusCapture={() => {
          setIsDockInteracting(true);
          showDock();
        }}
        onBlurCapture={() => {
          setIsDockInteracting(false);
          scheduleHide();
        }}
      >
        <Dock
          className="mt-0"
          direction="middle"
          iconSize={44}
          iconMagnification={66}
          iconDistance={170}
        >
          {dockEntries.map(renderMenuItem)}
          <DockDivider />
          <DockIcon aria-label="Sair">
            <DockItemContent label="Sair">
              <button
                type="button"
                onClick={logout}
                className="flex items-center justify-center w-full h-full text-destructive"
                aria-label="Sair"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </DockItemContent>
          </DockIcon>
        </Dock>
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
