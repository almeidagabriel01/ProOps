import type { ErrorIssue, IssueFilters, IssueTimeRange } from "@/types/observability";

const RANGE_MS: Record<Exclude<IssueTimeRange, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function rangeToFrom(range: IssueTimeRange, nowMs: number): string | null {
  if (range === "all") return null;
  return new Date(nowMs - RANGE_MS[range]).toISOString();
}

export function isQueryMode(f: IssueFilters): boolean {
  return f.range !== "all" || f.q.trim().length > 0 || f.sort !== "recent";
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, error: 1, warning: 2 };

export function applyClientFilters(issues: ErrorIssue[], f: IssueFilters): ErrorIssue[] {
  const q = f.q.trim().toLowerCase();
  const filtered = issues.filter((i) => {
    if (f.status !== "all" && i.status !== f.status) return false;
    if (f.severity !== "all" && i.severity !== f.severity) return false;
    if (f.source !== "all" && i.source !== f.source) return false;
    if (f.errorType !== "all" && i.errorType !== f.errorType) return false;
    if (q) {
      const hay = `${i.title} ${i.route ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return [...filtered].sort((a, b) => {
    if (f.sort === "frequent") return b.count - a.count;
    if (f.sort === "newest") return b.firstSeen.localeCompare(a.firstSeen);
    // recent: severity then lastSeen
    const s = (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9);
    return s !== 0 ? s : b.lastSeen.localeCompare(a.lastSeen);
  });
}
