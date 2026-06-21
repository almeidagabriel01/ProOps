"use client";

import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock } from "lucide-react";
import type { SubscriptionDisplayStatus } from "@/lib/subscription-status";

interface StatusBadgeProps {
  /** Already-derived display status (see deriveSubscriptionDisplayStatus). */
  status: SubscriptionDisplayStatus | string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-500/20 shadow-none font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
        Ativo
      </Badge>
    );
  }

  if (status === "canceling") {
    return (
      <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-500/20 shadow-none font-medium">
        <Clock className="w-3 h-3 mr-1" />
        Encerrando
      </Badge>
    );
  }

  if (status === "past_due") {
    return (
      <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-500/20 shadow-none font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
        Atrasado
      </Badge>
    );
  }

  if (status === "free") {
    return (
      <Badge
        variant="secondary"
        className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 shadow-none font-medium"
      >
        <Sparkles className="w-3 h-3 mr-1" />
        Gratuito
      </Badge>
    );
  }

  if (status === "inactive") {
    return (
      <Badge
        variant="secondary"
        className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 shadow-none font-medium"
      >
        Inativo
      </Badge>
    );
  }

  // canceled (and any unknown fallback)
  return (
    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-500/20 shadow-none font-medium">
      Cancelado
    </Badge>
  );
}
