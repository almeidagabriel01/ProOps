"use client";

import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface StatusBadgeProps {
  status: string;
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

  return (
    <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-500/20 shadow-none font-medium">
      Cancelado
    </Badge>
  );
}
