"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_SECTIONS, resolveActiveAdminSection } from "@/lib/admin-sections";
import { cn } from "@/lib/utils";

/**
 * Abas do painel do superadmin, no topo de toda pagina do /admin.
 * Rola na horizontal no celular em vez de quebrar a pagina.
 */
export function AdminSectionTabs() {
  const pathname = usePathname() || "";
  const active = resolveActiveAdminSection(pathname);

  return (
    <nav
      aria-label="Seções do painel super admin"
      className="border-b bg-background/80 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto px-4 md:px-6 [scrollbar-width:none]">
        {ADMIN_SECTIONS.map(({ href, label, icon: Icon }) => {
          const isActive = active === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
