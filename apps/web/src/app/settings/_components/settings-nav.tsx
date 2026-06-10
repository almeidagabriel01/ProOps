"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useHeaderPresentation } from "@/hooks/useHeaderPresentation";
import { getUserColor, getInitials } from "@/lib/avatar-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const { user } = useAuth();
  const { companyName, logoUrl, avatarSeed } = useHeaderPresentation();

  const userName = user?.name?.trim() || companyName;

  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-8">
      {/* Navigation card */}
      <nav
        aria-label="Navegação de configurações"
        className="rounded-xl border border-border/60 bg-card p-2"
      >
        <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:gap-3 lg:overflow-visible">
          {NAV_GROUPS.map((group) => (
            <div
              key={group.label}
              className="flex flex-row gap-1 lg:flex-col lg:gap-0.5"
            >
              <span className="hidden px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60 lg:block">
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
                        ? "bg-primary/10 font-medium text-primary ring-1 ring-primary/25"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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

      {/* User identity chip */}
      <div className="hidden items-center gap-3 rounded-xl border border-border/60 bg-card p-3 lg:flex">
        <Avatar className="h-9 w-9 shrink-0 border border-border">
          <AvatarImage src={logoUrl} alt={companyName} />
          <AvatarFallback
            style={{ backgroundColor: getUserColor(avatarSeed) }}
            className="text-xs font-semibold text-white"
          >
            {getInitials(avatarSeed)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {userName}
          </p>
          {companyName && companyName !== userName && (
            <p className="truncate text-xs text-primary">{companyName}</p>
          )}
        </div>
      </div>
    </aside>
  );
}
