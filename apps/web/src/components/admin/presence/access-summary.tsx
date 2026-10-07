"use client";

import { cn } from "@/lib/utils";
import { describeAccess, type PresenceInfo } from "@/lib/presence-format";
import { PresenceDot } from "./presence-indicator";

interface AccessSummaryProps {
  lastSeenAt?: string | null;
  presence?: PresenceInfo | null;
  /** `end` no card (valor à direita do rótulo); `start` na tabela. */
  align?: "start" | "end";
  className?: string;
  /** Tamanho da linha de baixo; o card usa a menor. */
  secondaryClassName?: string;
}

const PRIMARY_TONE = {
  online: "text-emerald-700 dark:text-emerald-400",
  away: "text-amber-700 dark:text-amber-400",
} as const;

/**
 * "Quando esta empresa usou o ERP", numa linha só: online ou ausente agora,
 * ou a hora em que saiu com quanto tempo ficou (`describeAccess`).
 */
export function AccessSummary({
  lastSeenAt,
  presence,
  align = "start",
  className,
  secondaryClassName = "text-xs",
}: AccessSummaryProps) {
  const access = describeAccess(lastSeenAt, presence);
  const live = access.status === "online" || access.status === "away";
  return (
    <span
      data-testid="access-summary"
      data-status={access.status ?? "unknown"}
      className={cn("flex flex-col", align === "end" ? "items-end text-right" : "items-start", className)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-medium",
          live
            ? PRIMARY_TONE[access.status as "online" | "away"]
            : access.stale
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground",
        )}
      >
        {live && <PresenceDot status={access.status!} />}
        {access.primary}
      </span>
      {access.secondary && (
        <span className={cn("text-muted-foreground", secondaryClassName)}>{access.secondary}</span>
      )}
    </span>
  );
}
