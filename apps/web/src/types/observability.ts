// apps/web/src/types/observability.ts
export type ErrorSeverity = "critical" | "error" | "warning";
export type ErrorSource = "web" | "functions";
export type ErrorIssueStatus = "unresolved" | "resolved" | "ignored";

export interface ErrorIssue {
  fingerprint: string;
  errorType: string;
  title: string;
  normalizedMessage: string;
  source: ErrorSource;
  route: string | null;
  method: string | null;
  severity: ErrorSeverity;
  status: ErrorIssueStatus;
  count: number;
  firstSeen: string;
  lastSeen: string;
  resolvedAt: string | null;
  affectedUsers: number;
  affectedTenants: number;
  tenantIds: string[];
  sampleStack: string;
  why: string | null;
  fix: string | null;
  link: string | null;
}

export interface ErrorOccurrence {
  id: string;
  uid: string | null;
  tenantId: string | null;
  route: string | null;
  method: string | null;
  status: number | null;
  stack: string;
  userAgent: string | null;
  createdAt: string;
}

export interface ErrorMetricWindow {
  windowId: string; // YYYYMMDDhh
  windowStart: string; // ISO
  counters: Record<string, number>; // `${severity}_${source}` -> count
}

export interface ResolvedUser {
  name: string;
  email: string;
}

export interface ResolvedTenant {
  name: string;
}

export type IssueSort = "recent" | "frequent" | "newest";
export type IssueTimeRange = "1h" | "24h" | "7d" | "30d" | "all";

export interface IssueFilters {
  status: ErrorIssueStatus | "all";
  severity: ErrorSeverity | "all";
  source: ErrorSource | "all";
  errorType: string | "all";
  q: string;
  range: IssueTimeRange;
  sort: IssueSort;
}

export interface ResolveIdentitiesResponse {
  users: Record<string, ResolvedUser>;
  tenants: Record<string, ResolvedTenant>;
}

export interface IssueSearchResponse {
  issues: ErrorIssue[];
  nextCursor: string | null;
}

export const DEFAULT_ISSUE_FILTERS: IssueFilters = {
  status: "all",
  severity: "all",
  source: "all",
  errorType: "all",
  q: "",
  range: "all",
  sort: "recent",
};
