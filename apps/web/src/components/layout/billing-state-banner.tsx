"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, CreditCard } from "lucide-react";

type BillingStateBannerVariant = "destructive" | "warning";

export interface BillingStateBannerProps {
  variant: BillingStateBannerVariant;
  message: string;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled?: boolean;
  ctaDisabledTooltip?: string;
  dataTestid: string;
  icon?: React.ReactNode;
}

export function BillingStateBanner({
  variant,
  message,
  ctaLabel,
  onCta,
  ctaDisabled,
  ctaDisabledTooltip,
  dataTestid,
  icon,
}: BillingStateBannerProps) {
  const isDestructive = variant === "destructive";

  const containerClass = cn(
    "w-full px-4 py-3 flex items-center justify-between gap-3",
    isDestructive
      ? "bg-destructive/10 border-b border-destructive/30 text-destructive"
      : "bg-yellow-50 dark:bg-yellow-950/90 border-b border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200",
  );

  const buttonClass = isDestructive
    ? undefined
    : "h-8 text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500 dark:text-yellow-300 dark:hover:bg-yellow-900/50";

  const defaultIcon = isDestructive ? (
    <CreditCard className="h-4 w-4 shrink-0" aria-hidden />
  ) : (
    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
  );

  return (
    <div role="status" data-testid={dataTestid} className={containerClass}>
      <div className="flex items-center gap-2 min-w-0">
        {icon ?? defaultIcon}
        <span className="text-sm font-medium truncate">{message}</span>
      </div>
      <Button
        variant={isDestructive ? "destructive" : "outline"}
        size="sm"
        onClick={onCta}
        disabled={ctaDisabled}
        title={ctaDisabled ? ctaDisabledTooltip : undefined}
        className={buttonClass}
        data-testid={`${dataTestid}-cta`}
      >
        {ctaLabel}
      </Button>
    </div>
  );
}
