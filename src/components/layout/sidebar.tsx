"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTenant } from "@/providers/tenant-provider"; // Import added
import {
  LayoutDashboard,
  ShoppingBag,
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

export function Sidebar() {
  const pathname = usePathname();
  const { tenant } = useTenant();
  const { logout } = useAuth();

  // If no tenant is selected (e.g. on Admin page or logged out state), verify path
  if (pathname.startsWith("/admin")) {
    return null; // Don't show app sidebar on super admin page
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex flex-col z-50 transition-colors duration-500">
      <div className="p-6 flex items-center gap-2 border-b border-border h-16">
        {tenant?.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tenant.logoUrl}
            alt="Brand"
            className="w-8 h-8 object-contain"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center transition-colors duration-500">
            <span className="text-primary-foreground font-bold text-lg">
              {tenant ? tenant.name.charAt(0).toUpperCase() : "E"}
            </span>
          </div>
        )}

        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight line-clamp-1">
            {tenant ? tenant.name : "ERP PRO"}
          </span>
          {tenant && (
            <span className="text-[10px] text-muted-foreground uppercase">
              Enterprise
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          // Best Match Logic:
          // 1. Must match the start of the path
          // 2. Must not have a specialized child that ALSO matches (and is longer)

          const isMatch =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          // Check if there's a more specific menu item that matches the current pathname
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
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 border-l-4",
                isActive
                  ? "border-primary bg-primary/10 text-primary" // Branded Active State
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
