"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { LogOut } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useSidebar } from "./useSidebar";
import {
  COLLAPSED_WIDTH,
  EXPANDED_WIDTH,
  lightenColor,
  getVisibleChildren,
} from "./config";
import { MenuItemLink, RestrictedMenuItem, SubmenuItem } from "./menu-items";

interface SidebarProps {
  onExpandChange?: (expanded: boolean) => void;
}

export function Sidebar({ onExpandChange }: SidebarProps) {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const { logout, user } = useAuth();
  const { hasFinancial } = usePlanLimits();
  const { isMaster } = usePermissions();
  const upgradeModal = useUpgradeModal();

  const {
    isExpanded,
    userPlanName,
    expandedMenus,
    visibleMenuItems,
    handleMouseEnter,
    handleMouseLeave,
    toggleSubmenu,
    isMenuActive,
    isParentActive,
  } = useSidebar(onExpandChange);

  // Hide on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const primaryColor = tenant?.primaryColor || "#2563eb";
  const premiumColor = lightenColor(primaryColor, 25);

  return (
    <>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          transform: "translateZ(0)",
        }}
        className="fixed mt-1 left-0 top-0 h-screen bg-sidebar flex flex-col z-50 transition-[width] duration-300 ease-out will-change-[width]"
      >
        <div className="absolute inset-0 bg-sidebar overflow-hidden flex flex-col">
          {/* Header / Logo area */}
          <div className="px-4 py-4 flex items-center gap-3 border-b border-border h-16 min-h-16">
            {tenant?.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt="Brand"
                className="w-10 h-10 object-contain shrink-0 rounded-lg"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center transition-colors duration-500 shrink-0">
                <span className="text-primary-foreground font-bold text-lg">
                  {tenant ? tenant.name.charAt(0).toUpperCase() : "E"}
                </span>
              </div>
            )}

            <div
              className={cn(
                "flex flex-col overflow-hidden transition-all duration-300",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
              )}
            >
              <span className="text-sm font-bold tracking-tight whitespace-nowrap">
                {tenant?.name || user?.name || "Usuário"}
              </span>
              {tenant && userPlanName && (
                <span className="text-[10px] text-muted-foreground uppercase whitespace-nowrap">
                  {userPlanName}
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
            {visibleMenuItems.map((item) => {
              const isRestricted = item.requiresFinancial && !hasFinancial;
              const hasChildren =
                item.children && getVisibleChildren(item, isMaster).length > 0;
              const isSubmenuOpen = expandedMenus.has(item.href);

              // Restricted by plan
              if (isRestricted) {
                return (
                  <RestrictedMenuItem
                    key={item.href}
                    item={item}
                    isExpanded={isExpanded}
                    premiumColor={premiumColor}
                    onUpgrade={() =>
                      upgradeModal.showUpgradeModal(
                        item.label,
                        "Controle suas finanças com nosso módulo completo.",
                        "pro"
                      )
                    }
                  />
                );
              }

              // Has submenu
              if (hasChildren) {
                return (
                  <SubmenuItem
                    key={item.href}
                    item={item}
                    isExpanded={isExpanded}
                    isSubmenuOpen={isSubmenuOpen}
                    isParentActive={isParentActive(item)}
                    onToggle={() => toggleSubmenu(item.href)}
                    pathname={pathname}
                  />
                );
              }

              // Regular menu item
              return (
                <MenuItemLink
                  key={item.href}
                  item={item}
                  isActive={isMenuActive(item)}
                  isExpanded={isExpanded}
                />
              );
            })}
          </nav>

          {/* Footer / Logout */}
          <div className="p-3 border-t border-border">
            <button
              onClick={logout}
              className="group flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200 cursor-pointer"
            >
              <LogOut className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-300",
                  isExpanded
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-2 w-0"
                )}
              >
                Sair
              </span>
            </button>
          </div>
        </div>
      </aside>
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

export { COLLAPSED_WIDTH, EXPANDED_WIDTH };
