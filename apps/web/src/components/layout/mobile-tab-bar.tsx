"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Crown,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  UserCircle,
} from "lucide-react";

import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { MobileNavSheet } from "@/components/layout/mobile-nav-sheet";
import {
  useActiveEntryHref,
  useDockEntries,
  type DockEntry,
} from "@/components/layout/use-dock-entries";
import { cn } from "@/lib/utils";
import { useThemePrimaryColor } from "@/hooks/useThemePrimaryColor";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";

/** Destinations that stay permanently visible; the rest move into "Mais". */
const VISIBLE_TABS = 4;

const SUPERADMIN_ENTRIES: DockEntry[] = [
  { icon: LayoutDashboard, label: "Painel", href: "/admin" },
  { icon: BarChart3, label: "Visão Geral", href: "/admin/overview" },
  { icon: UserCircle, label: "Perfil", href: "/profile" },
];

const TAB_CLASS =
  "flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors";

function TabButton({
  active,
  label,
  children,
  ...props
}: {
  active?: boolean;
  label: string;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(TAB_CLASS, active ? "text-foreground" : "text-muted-foreground")}
      {...props}
    >
      {children}
    </button>
  );
}

function TabLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="max-w-full truncate text-[10px] font-medium leading-tight">
      {children}
    </span>
  );
}

/**
 * Mobile counterpart of the desktop `BottomDock`.
 *
 * Renders below `md` only. Both surfaces read the same `useDockEntries()`
 * model, so plan/permission/niche gating cannot drift between them.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { tenant } = useTenant();
  const { hasFinancial, hasKanban } = usePlanLimits();
  const upgradeModal = useUpgradeModal();
  const premiumColor = useThemePrimaryColor();

  const [sheetOpen, setSheetOpen] = React.useState(false);

  const isAdminPage = pathname.startsWith("/admin");
  const isSuperAdminMode = user?.role === "superadmin" && !tenant;

  const tenantEntries = useDockEntries();
  const entries = isSuperAdminMode ? SUPERADMIN_ENTRIES : tenantEntries;
  const activeHref = useActiveEntryHref(entries, pathname);

  const handleRestrictedClick = React.useCallback(
    (entry: DockEntry) => {
      const isEnterpriseRestricted = !!entry.requiresEnterprise && !hasKanban;
      const isCrmEntry = entry.pageId === "kanban" || entry.href === "/crm";
      const description =
        isEnterpriseRestricted && isCrmEntry
          ? "O módulo CRM pode ser contratado como add-on ou vem incluído no plano Enterprise."
          : isEnterpriseRestricted
            ? "Gerencie suas propostas e lançamentos com nosso CRM visual."
            : "Controle suas finanças com nosso módulo completo.";
      upgradeModal.showUpgradeModal(
        entry.label,
        description,
        isEnterpriseRestricted ? "enterprise" : "pro",
      );
    },
    [hasKanban, upgradeModal],
  );

  // Mesma regra da dock: nada de navegação no /admin, exceto superadmin sem tenant.
  if (isAdminPage && !isSuperAdminMode) {
    return null;
  }

  const primaryEntries = entries.slice(0, VISIBLE_TABS);
  const overflowEntries = entries.slice(VISIBLE_TABS);
  const hasOverflow = overflowEntries.length > 0;

  const activeIsInOverflow =
    !!activeHref && overflowEntries.some((entry) => entry.href === activeHref);

  // "Sair" só cabe direto na barra quando não há um "Mais" para abrigá-lo.
  const showLogoutTab = !hasOverflow;
  const columns =
    primaryEntries.length + (hasOverflow ? 1 : 0) + (showLogoutTab ? 1 : 0);

  return (
    <>
      <nav
        aria-label="Navegação principal"
        data-testid="mobile-tab-bar"
        className="shrink-0 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: "repeat(" + columns + ", minmax(0, 1fr))" }}
        >
          {primaryEntries.map((entry) => {
            const isFinancialRestricted =
              !!entry.requiresFinancial && !hasFinancial;
            const isEnterpriseRestricted =
              !!entry.requiresEnterprise && !hasKanban;
            const isRestricted = isFinancialRestricted || isEnterpriseRestricted;
            const active = !!activeHref && entry.href === activeHref;

            if (isRestricted) {
              return (
                <TabButton
                  key={entry.href}
                  label={entry.label}
                  onClick={() => handleRestrictedClick(entry)}
                >
                  <span className="relative">
                    <entry.icon
                      className="h-5 w-5"
                      style={{ color: premiumColor }}
                    />
                    <Crown
                      className="absolute -right-2 -top-1 h-3 w-3"
                      style={{ color: premiumColor }}
                    />
                  </span>
                  <TabLabel>{entry.label}</TabLabel>
                </TabButton>
              );
            }

            const inner = (
              <>
                <entry.icon className="h-5 w-5" />
                <TabLabel>{entry.label}</TabLabel>
              </>
            );

            const className = cn(
              TAB_CLASS,
              active ? "text-foreground" : "text-muted-foreground",
            );

            if (entry.external) {
              return (
                <a
                  key={entry.href}
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  aria-label={entry.label}
                >
                  {inner}
                </a>
              );
            }

            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={className}
                aria-label={entry.label}
                aria-current={active ? "page" : undefined}
              >
                {inner}
              </Link>
            );
          })}

          {hasOverflow && (
            <TabButton
              label="Mais"
              data-testid="mobile-tab-more"
              active={activeIsInOverflow || sheetOpen}
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
            >
              <MoreHorizontal className="h-5 w-5" />
              <TabLabel>Mais</TabLabel>
            </TabButton>
          )}

          {showLogoutTab && (
            <TabButton label="Sair" onClick={logout}>
              <LogOut className="h-5 w-5 text-destructive" />
              <TabLabel>Sair</TabLabel>
            </TabButton>
          )}
        </div>
      </nav>

      {hasOverflow && (
        <MobileNavSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          entries={overflowEntries}
          activeHref={activeHref}
          hasFinancial={hasFinancial}
          hasKanban={hasKanban}
          onRestrictedClick={(entry) => {
            setSheetOpen(false);
            handleRestrictedClick(entry);
          }}
          onLogout={logout}
        />
      )}

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
