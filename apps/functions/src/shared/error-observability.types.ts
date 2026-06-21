export type ErrorSeverity = "critical" | "error" | "warning";
export type ErrorSource = "web" | "functions";
export type ErrorIssueStatus = "unresolved" | "resolved" | "ignored";

/**
 * Normalized input for the ingest pipeline. The fingerprint is ALWAYS computed
 * server-side from these fields — never trusted from a client.
 */
export interface IngestErrorInput {
  errorType: string;
  message: string;
  stack: string | null;
  source: ErrorSource;
  route: string | null;
  method: string | null;
  status: number | null;
  uid: string | null;
  tenantId: string | null;
  userAgent: string | null;
  /** evlog structured-error fields, when present. */
  why: string | null;
  fix: string | null;
  link: string | null;
}

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
  firstSeen: string; // ISO
  lastSeen: string; // ISO
  resolvedAt: string | null;
  affectedUsers: number;
  affectedTenants: number;
  tenantIds: string[]; // capped at 20, display-only
  sampleStack: string;
  why: string | null;
  fix: string | null;
  link: string | null;
}

export interface ErrorOccurrence {
  uid: string | null;
  tenantId: string | null;
  route: string | null;
  method: string | null;
  status: number | null;
  stack: string;
  userAgent: string | null;
  createdAt: string; // ISO
  expiresAt: string; // ISO — Firestore TTL field
}
