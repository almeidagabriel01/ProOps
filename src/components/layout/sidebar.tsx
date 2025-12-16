"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
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
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type MenuItem = {
  icon: typeof LayoutDashboard;
  label: string;
  href: string;
  requiresFinancial?: boolean;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Package, label: "Produtos", href: "/products" },
  { icon: FileText, label: "Propostas", href: "/proposals" },
  { icon: Users, label: "Clientes", href: "/customers" },
  {
    icon: Wallet,
    label: "Financeiro",
    href: "/financial",
    requiresFinancial: true,
  },
  { icon: Settings, label: "Configurações", href: "/settings" },
];

// Collapsed width (icons only) and expanded width
const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 300;

interface SidebarProps {
  onExpandChange?: (expanded: boolean) => void;
}

export function Sidebar({ onExpandChange }: SidebarProps) {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const { logout, user } = useAuth();
  const { hasFinancial } = usePlanLimits();
  const upgradeModal = useUpgradeModal();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userPlanName, setUserPlanName] = useState<string | null>(null);

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

  // If no tenant is selected (e.g. on Admin page or logged out state), verify path
  if (pathname.startsWith("/admin")) {
    return null; // Don't show app sidebar on super admin page
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
  const premiumColor = lightenColor(primaryColor, 25); // 25% lighter

  return (
    <>
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        className="fixed mt-1 left-0 top-0 h-screen bg-card flex flex-col z-50 transition-all duration-300 ease-in-out"
      >
        {/* Inner container */}
        <div className="absolute inset-0 bg-card overflow-hidden flex flex-col">
          {/* Header / Logo area */}
          <div className="px-4 py-4 flex items-center gap-3 border-b border-border h-16 min-h-16">
            {tenant?.logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
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

            {/* User name - only visible when expanded */}
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
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
            {menuItems.map((item) => {
              // Check if this item is restricted
              const isRestricted = item.requiresFinancial && !hasFinancial;

              const isMatch =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

              const hasBetterMatch = menuItems.some(
                (other) =>
                  other !== item &&
                  other.href.length > item.href.length &&
                  pathname.startsWith(other.href)
              );

              const isActive = isMatch && !hasBetterMatch && !isRestricted;

              // If restricted, show as clickable with crown icon
              if (isRestricted) {
                return (
                  <button
                    key={item.href}
                    onClick={() =>
                      upgradeModal.showUpgradeModal(
                        item.label,
                        "Controle suas finanças, receitas e despesas com nosso módulo completo.",
                        "pro"
                      )
                    }
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 w-full hover:bg-primary/10"
                    style={{ color: premiumColor }}
                  >
                    {/* Icon with crown overlay */}
                    <div className="relative shrink-0">
                      <item.icon className="w-5 h-5" />
                      {/* Small crown badge visible when collapsed */}
                      <Crown
                        className={cn(
                          "absolute -top-1.5 -right-1.5 w-3 h-3 transition-all duration-300",
                          isExpanded
                            ? "opacity-0 scale-75"
                            : "opacity-100 scale-100"
                        )}
                        style={{ color: premiumColor }}
                      />
                    </div>
                    <span
                      className={cn(
                        "whitespace-nowrap transition-all duration-300 flex-1 text-left",
                        isExpanded
                          ? "opacity-100 translate-x-0"
                          : "opacity-0 -translate-x-2 w-0"
                      )}
                    >
                      {item.label}
                    </span>
                    {/* Crown at end visible when expanded */}
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
                  {/* Label with hover animation - slides right on hover */}
                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-300",
                      isExpanded
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-2 w-0",
                      !isActive && "group-hover:translate-x-1"
                    )}
                  >
                    {item.label}
                  </span>

                  {/* Active indicator pill */}
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

      {/* Upgrade Modal */}
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

// Export width values for layout usage
export { COLLAPSED_WIDTH, EXPANDED_WIDTH };
