"use client";

import { cn } from "@/lib/utils";
import { describePresence, type PresenceInfo, type PresenceStatus } from "@/lib/presence-format";

const DOT_CLASS: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-muted-foreground/40",
};

const TEXT_CLASS: Record<PresenceStatus, string> = {
  online: "text-emerald-700 dark:text-emerald-400",
  away: "text-amber-700 dark:text-amber-400",
  offline: "text-muted-foreground",
};

interface PresenceDotProps {
  status: PresenceStatus;
  className?: string;
}

/** Bolinha de estado; pulsa quando a pessoa está online. */
export function PresenceDot({ status, className }: PresenceDotProps) {
  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)} aria-hidden>
      {status === "online" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", DOT_CLASS[status])} />
    </span>
  );
}

interface PresenceIndicatorProps {
  presence?: PresenceInfo | null;
  className?: string;
}

/**
 * "Online desde 10:15", "Ausente, entrou 10:15" ou "Saiu 10:20, ficou 5 min".
 * Sem nenhum aviso de presença registrado, não desenha nada.
 */
export function PresenceIndicator({ presence, className }: PresenceIndicatorProps) {
  const text = describePresence(presence);
  if (!presence || !text) return null;
  return (
    <span
      data-testid="presence-indicator"
      data-status={presence.status}
      className={cn("inline-flex items-center gap-1.5 font-medium", TEXT_CLASS[presence.status], className)}
    >
      <PresenceDot status={presence.status} />
      {text}
    </span>
  );
}
