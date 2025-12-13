"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/tenant-provider";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Package,
  Users,
  FileText,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Package, label: "Produtos", href: "/products" },
  { icon: FileText, label: "Propostas", href: "/proposals" },
  { icon: Users, label: "Clientes", href: "/customers" },
  { icon: Wallet, label: "Financeiro", href: "/financial" },
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
  const { logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
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

          {/* Company name - only visible when expanded */}
          <div
            className={cn(
              "flex flex-col overflow-hidden transition-all duration-300",
              isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
            )}
          >
            <span className="text-sm font-bold tracking-tight whitespace-nowrap">
              {tenant ? tenant.name : "ERP PRO"}
            </span>
            {tenant && (
              <span className="text-[10px] text-muted-foreground uppercase whitespace-nowrap">
                Enterprise
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {menuItems.map((item) => {
            const isMatch =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            const hasBetterMatch = menuItems.some(
              (other) =>
                other !== item &&
                other.href.length > item.href.length &&
                pathname.startsWith(other.href)
            );

            const isActive = isMatch && !hasBetterMatch;

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
  );
}

// Export width values for layout usage
export { COLLAPSED_WIDTH, EXPANDED_WIDTH };
