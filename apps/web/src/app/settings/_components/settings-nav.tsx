"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Conta",
    items: [
      { label: "Segurança", href: "/settings/security", icon: ShieldCheck },
    ],
  },
  {
    label: "Organização",
    items: [
      { label: "Equipe", href: "/settings/team", icon: Users },
      {
        label: "Pagamento Online",
        href: "/settings/payments",
        icon: CreditCard,
      },
    ],
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação de configurações"
      className="lg:sticky lg:top-8"
    >
      <div className="flex flex-row gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:gap-6 lg:overflow-visible lg:pb-0">
        {NAV_GROUPS.map((group) => (
          <div
            key={group.label}
            className="flex flex-row gap-1.5 lg:flex-col lg:gap-1"
          >
            <span className="hidden px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/70 lg:mb-1 lg:block">
              {group.label}
            </span>
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
