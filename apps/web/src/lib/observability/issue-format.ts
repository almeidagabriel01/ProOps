// apps/web/src/lib/observability/issue-format.ts
import type { ErrorIssue, ErrorSeverity, ErrorIssueStatus } from "@/types/observability";

const RANK: Record<ErrorSeverity, number> = { warning: 1, error: 2, critical: 3 };

export function severityRank(s: ErrorSeverity): number {
  return RANK[s] ?? 0;
}

export function sortIssues(issues: ErrorIssue[]): ErrorIssue[] {
  return [...issues].sort((a, b) => {
    const r = severityRank(b.severity) - severityRank(a.severity);
    if (r !== 0) return r;
    return Date.parse(b.lastSeen) - Date.parse(a.lastSeen);
  });
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - Date.parse(iso));
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export function severityAccent(s: ErrorSeverity): { text: string; border: string; dot: string } {
  switch (s) {
    case "critical":
      return { text: "text-red-500", border: "border-red-500/40", dot: "bg-red-500" };
    case "warning":
      return { text: "text-amber-500", border: "border-amber-500/40", dot: "bg-amber-500" };
    default:
      return { text: "text-zinc-400", border: "border-zinc-500/30", dot: "bg-zinc-400" };
  }
}

export function statusLabel(s: ErrorIssueStatus): string {
  switch (s) {
    case "resolved":
      return "Resolvido";
    case "ignored":
      return "Ignorado";
    default:
      return "Não resolvido";
  }
}
