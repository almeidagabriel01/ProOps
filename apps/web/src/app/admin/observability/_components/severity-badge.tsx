// apps/web/src/app/admin/observability/_components/severity-badge.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ErrorSeverity } from "@/types/observability";
import { severityAccent } from "@/lib/observability/issue-format";

const LABEL: Record<ErrorSeverity, string> = {
  critical: "Crítico",
  error: "Erro",
  warning: "Alerta",
};

export function SeverityBadge({ severity, className }: { severity: ErrorSeverity; className?: string }) {
  const a = severityAccent(severity);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", a.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", a.dot)} />
      {LABEL[severity]}
    </span>
  );
}
