"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Package,
  Users,
  FileText,
  Wallet,
  Crown,
  User,
  CreditCard,
  ChevronRight,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ============================================
// TYPES
// ============================================

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  pageId?: string;
  requiresFinancial?: boolean;
  masterOnly?: boolean;
  children?: SubMenuItem[];
};

type SubMenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  masterOnly?: boolean;
};

// ============================================
// MENU CONFIGURATION
// ============================================

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", pageId: "dashboard" },
  { icon: Package, label: "Produtos", href: "/products", pageId: "products" },
  { icon: FileText, label: "Propostas", href: "/proposals", pageId: "proposals" },
  { icon: UsersRound, label: "Clientes", href: "/customers", pageId: "clients" },
  {
    icon: Wallet,
    label: "Financeiro",
    href: "/financial",
    pageId: "financial",
    requiresFinancial: true,
  },
  {
    icon: User,
    label: "Perfil",
    href: "/profile"
  },
  {
    icon: Settings,
    label: "Configurações",
    href: "/settings",
    pageId: "settings",
    children: [
      { icon: Users, label: "Equipe", href: "/settings/team", masterOnly: true },
      { icon: CreditCard, label: "Plano", href: "/settings/billing", masterOnly: true },
    ],
  },
];

// Collapsed width (icons only) and expanded width
const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 300;

// ============================================
// COMPONENT
// ============================================

interface SidebarProps {
  onExpandChange?: (expanded: boolean) => void;
}

export function Sidebar({ onExpandChange }: SidebarProps) {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const { logout, user } = useAuth();
  const { hasFinancial } = usePlanLimits();
  const { hasPermission, isMaster } = usePermissions();
  const upgradeModal = useUpgradeModal();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userPlanName, setUserPlanName] = useState<string | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Filter menu items based on permissions
  const visibleMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // MASTER sees everything
      if (isMaster) return true;

      // MEMBER: check if they can view this page
      if (item.pageId) {
        // For Settings, check if there are any visible children
        if (item.children) {
          const visibleChildren = item.children.filter(child => !child.masterOnly);
          return visibleChildren.length > 0;
        }
        return hasPermission(item.pageId, 'view');
      }

      return true;
    });
  }, [isMaster, hasPermission]);

  // Get visible children for a menu item
  const getVisibleChildren = (item: MenuItem): SubMenuItem[] => {
    if (!item.children) return [];
    return item.children.filter(child => {
      if (child.masterOnly) return isMaster;
      return true;
    });
  };

  // Toggle submenu expansion
  const toggleSubmenu = (href: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  };

  // Auto-expand menu if one of its children is active
  useEffect(() => {
    menuItems.forEach(item => {
      if (item.children) {
        const isChildActive = item.children.some(child =>
          pathname === child.href || pathname.startsWith(child.href + "/")
        );
        if (isChildActive) {
          setExpandedMenus(prev => new Set([...prev, item.href]));
        }
      }
    });
  }, [pathname]);

  // Fetch user's current plan name
  useEffect(() => {
    const fetchPlanName = async () => {
      if (!user?.planId) {
        setUserPlanName(user?.role === "free" ? "Gratuito" : null);
        return;
      }
      try {
        const planDoc = await getDoc(doc(db, "plans", user.planId));
        if (planDoc.exists()) {
          const planData = planDoc.data();
          setUserPlanName(planData.name || planData.tier);
        }
      } catch (error) {
        console.error("Error fetching plan:", error);
      }
    };
    fetchPlanName();
  }, [user?.planId, user?.role]);

  const handleMouseEnter = () => {
    setIsExpanded(true);
    onExpandChange?.(true);
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
    onExpandChange?.(false);
  };

  // Hide on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  // Helper function to lighten a hex color
  const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return (
      "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    );
  };

  const primaryColor = tenant?.primaryColor || "#2563eb";
  const premiumColor = lightenColor(primaryColor, 25);

  return (
    <>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        className="fixed mt-1 left-0 top-0 h-screen bg-card flex flex-col z-50 transition-all duration-300 ease-in-out"
      >
        <div className="absolute inset-0 bg-card overflow-hidden flex flex-col">
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
                {user?.name || "Usuário"}
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
              const hasChildren = item.children && getVisibleChildren(item).length > 0;
              const isSubmenuOpen = expandedMenus.has(item.href);

              const isMatch =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              const hasBetterMatch = visibleMenuItems.some(
                (other) =>
                  other !== item &&
                  other.href.length > item.href.length &&
                  pathname.startsWith(other.href)
              );

              const isActive = isMatch && !hasBetterMatch && !isRestricted && !hasChildren;
              const isParentActive = hasChildren && item.children?.some(
                child => pathname === child.href || pathname.startsWith(child.href + "/")
              );

              // Restricted by plan
              if (isRestricted) {
                return (
                  <button
                    key={item.href}
                    onClick={() =>
                      upgradeModal.showUpgradeModal(
                        item.label,
                        "Controle suas finanças com nosso módulo completo.",
                        "pro"
                      )
                    }
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full hover:bg-primary/10"
                    style={{ color: premiumColor }}
                  >
                    <div className="relative shrink-0">
                      <item.icon className="w-5 h-5" />
                      <Crown
                        className={cn(
                          "absolute -top-1.5 -right-1.5 w-3 h-3 transition-all duration-300",
                          isExpanded ? "opacity-0 scale-75" : "opacity-100 scale-100"
                        )}
                        style={{ color: premiumColor }}
                      />
                    </div>
                    <span
                      className={cn(
                        "whitespace-nowrap transition-all duration-300 flex-1 text-left",
                        isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 w-0"
                      )}
                    >
                      {item.label}
                    </span>
                    <Crown
                      className={cn(
                        "w-4 h-4 shrink-0 transition-all duration-300",
                        isExpanded ? "opacity-100" : "opacity-0"
                      )}
                      style={{ color: premiumColor }}
                    />
                  </button>
                );
              }

              // Has submenu
              if (hasChildren) {
                const visibleChildren = getVisibleChildren(item);

                return (
                  <div key={item.href}>
                    {/* Parent menu item */}
                    <button
                      onClick={() => toggleSubmenu(item.href)}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full",
                        isParentActive || isSubmenuOpen
                          ? "text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "w-5 h-5 shrink-0 transition-transform duration-200",
                          !isParentActive && "group-hover:scale-110"
                        )}
                      />
                      <span
                        className={cn(
                          "whitespace-nowrap transition-all duration-300 flex-1 text-left",
                          isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 w-0"
                        )}
                      >
                        {item.label}
                      </span>
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 shrink-0 transition-all duration-300",
                          isExpanded ? "opacity-100" : "opacity-0",
                          isSubmenuOpen && "rotate-90"
                        )}
                      />
                    </button>

                    {/* Submenu items */}
                    {isSubmenuOpen && isExpanded && (
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-border/50 pl-3">
                        {visibleChildren.map((child) => {
                          const isChildActive = pathname === child.href ||
                            pathname.startsWith(child.href + "/");

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                                isChildActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <child.icon className="w-4 h-4 shrink-0" />
                              <span>{child.label}</span>
                              {child.masterOnly && (
                                <Crown className="w-3 h-3 ml-auto text-amber-500" />
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular menu item
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-5 h-5 shrink-0 transition-transform duration-200",
                      !isActive && "group-hover:scale-110"
                    )}
                  />
                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-300",
                      isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 w-0",
                      !isActive && "group-hover:translate-x-1"
                    )}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div
                      className={cn(
                        "ml-auto h-2 w-2 rounded-full bg-primary transition-all duration-300",
                        isExpanded ? "opacity-100" : "opacity-0"
                      )}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer / Logout */}
          <div className="p-3 border-t border-border">
            <button
              onClick={logout}
              className="group flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200"
            >
              <LogOut className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-300",
                  isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 w-0"
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
