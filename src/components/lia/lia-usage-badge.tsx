"use client";

import { cn } from "@/lib/utils";

interface LiaUsageBadgeProps {
  messagesUsed: number;
  messagesLimit: number;
  isLoading?: boolean;
}

export function LiaUsageBadge({
  messagesUsed,
  messagesLimit,
  isLoading,
}: LiaUsageBadgeProps) {
  if (isLoading) return null;

  const isAtLimit = messagesUsed >= messagesLimit;
  const isNearLimit = !isAtLimit && messagesUsed >= Math.floor(messagesLimit * 0.8);

  return (
    <span
      aria-label={`${messagesUsed} de ${messagesLimit} mensagens usadas`}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0",
        isAtLimit
          ? "bg-destructive/10 text-destructive"
          : isNearLimit
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-secondary text-secondary-foreground",
      )}
    >
      {messagesUsed} / {messagesLimit}
    </span>
  );
}
