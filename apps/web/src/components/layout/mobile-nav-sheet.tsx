"use client";

import * as React from "react";
import Link from "next/link";
import { Crown, LogOut } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { DockEntry } from "@/components/layout/use-dock-entries";
import { useThemePrimaryColor } from "@/hooks/useThemePrimaryColor";
import {
  resolveCapabilityRestriction,
  type MenuCapabilityMap,
} from "@/components/layout/capability-gate";

interface MobileNavSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Destinations that did not fit in the tab bar. */
  entries: DockEntry[];
  activeHref: string | null;
  capabilities: MenuCapabilityMap;
  onRestrictedClick: (entry: DockEntry) => void;
  onLogout: () => void;
}

export function MobileNavSheet({
  open,
  onOpenChange,
  entries,
  activeHref,
  capabilities,
  onRestrictedClick,
  onLogout,
}: MobileNavSheetProps) {
  const premiumColor = useThemePrimaryColor();

  const rowClass =
    "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80svh] overflow-y-auto rounded-t-2xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="mb-2">
          <SheetTitle className="text-base">Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Demais seções do sistema
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="Mais seções" className="flex flex-col gap-1">
          {entries.map((entry) => {
            const { restricted: isRestricted } = resolveCapabilityRestriction(
              entry.requiresCapability,
              capabilities,
            );
            const active = !!activeHref && entry.href === activeHref;

            if (isRestricted) {
              return (
                <button
                  key={entry.href}
                  type="button"
                  onClick={() => onRestrictedClick(entry)}
                  className={cn(rowClass, "opacity-70 hover:bg-muted/60")}
                >
                  <entry.icon
                    className="h-5 w-5 shrink-0"
                    style={{ color: premiumColor }}
                  />
                  <span className="flex-1">{entry.label}</span>
                  <Crown className="h-4 w-4" style={{ color: premiumColor }} />
                </button>
              );
            }

            const content = (
              <>
                <entry.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{entry.label}</span>
              </>
            );

            const className = cn(
              rowClass,
              active
                ? "bg-primary/15 text-foreground ring-1 ring-primary/30"
                : "text-foreground/85 hover:bg-muted/60",
            );

            if (entry.external) {
              return (
                <a
                  key={entry.href}
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                  onClick={() => onOpenChange(false)}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={className}
                aria-current={active ? "page" : undefined}
                onClick={() => onOpenChange(false)}
              >
                {content}
              </Link>
            );
          })}

          <div className="my-1 h-px bg-border" />

          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onLogout();
            }}
            className={cn(rowClass, "text-destructive hover:bg-destructive/10")}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="flex-1">Sair</span>
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
