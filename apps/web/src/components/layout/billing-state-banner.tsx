"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AlertTriangle, CreditCard, Sparkles } from "lucide-react";

type BillingStateBannerVariant = "destructive" | "warning" | "info";

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

const VARIANT_STYLES: Record<
  BillingStateBannerVariant,
  { container: string; button?: string; icon: React.ReactNode }
> = {
  destructive: {
    container: "bg-destructive/10 border-b border-destructive/30 text-destructive",
    icon: <CreditCard className="h-4 w-4 shrink-0" aria-hidden />,
  },
  warning: {
    container:
      "bg-yellow-50 dark:bg-yellow-950/90 border-b border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-200",
    button:
      "h-8 text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-500 dark:text-yellow-300 dark:hover:bg-yellow-900/50",
    icon: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />,
  },
  info: {
    container:
      "bg-blue-50 dark:bg-blue-950/90 border-b border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200",
    button:
      "h-8 text-xs border-blue-500 text-blue-700 hover:bg-blue-100 dark:border-blue-500 dark:text-blue-300 dark:hover:bg-blue-900/50",
    icon: <Sparkles className="h-4 w-4 shrink-0" aria-hidden />,
  },
};

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
  const styles = VARIANT_STYLES[variant];
  const buttonVariant = variant === "destructive" ? "destructive" : "outline";

  const buttonNode =
    ctaDisabled && ctaDisabledTooltip ? (
      <Tooltip content={ctaDisabledTooltip} side="top">
        <Button
          variant={buttonVariant}
          size="sm"
          onClick={onCta}
          disabled
          className={styles.button}
          data-testid={`${dataTestid}-cta`}
        >
          {ctaLabel}
        </Button>
      </Tooltip>
    ) : (
      <Button
        variant={buttonVariant}
        size="sm"
        onClick={onCta}
        disabled={ctaDisabled}
        className={styles.button}
        data-testid={`${dataTestid}-cta`}
      >
        {ctaLabel}
      </Button>
    );

  return (
    <div
      role="status"
      data-testid={dataTestid}
      className={cn(
        "w-full px-4 py-3 flex items-center justify-between gap-3",
        styles.container,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon ?? styles.icon}
        <span className="text-sm font-medium truncate">{message}</span>
      </div>
      {buttonNode}
    </div>
  );
}
