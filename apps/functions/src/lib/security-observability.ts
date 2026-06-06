import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../init";

export type SecurityCounterName =
  | "AUTH_COMPAT"
  | "AUTH_CLAIMS_MISSING_ROLE"
  | "AUTH_CLAIMS_MISSING_TENANT"
  | "FORBIDDEN_TENANT_MISMATCH"
  | "webhook_failed"
  | "cors_denied"
  | "ratelimit_triggered"
  | "plan_limit_blocked"
  | "plan_limit_would_block"
  | "plan_source_compat_default"
  | "whatsapp_eligibility_denied"
  | "whatsapp_message_dedupe_hit"
  | "super_admin_impersonation_started"
  | "super_admin_tenant_write"
  | "super_admin_destructive_op"
  | "super_admin_not_allowlisted"
  | "super_admin_mfa_required";

type SecurityLogLevel = "INFO" | "WARN" | "ERROR";

type RequestUser = {
  uid?: unknown;
  tenantId?: unknown;
};

export type SecurityLogContext = {
  requestId?: string;
  route?: string;
  status?: number;
  tenantId?: string;
  uid?: string;
  eventId?: string;
  reason?: string;
  source?: string;
  ip?: string;
};

const KNOWN_COUNTERS = new Set<SecurityCounterName>([
  "AUTH_COMPAT",
  "AUTH_CLAIMS_MISSING_ROLE",
  "AUTH_CLAIMS_MISSING_TENANT",
  "FORBIDDEN_TENANT_MISMATCH",
  "webhook_failed",
  "cors_denied",
  "ratelimit_triggered",
  "plan_limit_blocked",
  "plan_limit_would_block",
  "plan_source_compat_default",
  "whatsapp_eligibility_denied",
  "whatsapp_message_dedupe_hit",
  "super_admin_impersonation_started",
  "super_admin_tenant_write",
  "super_admin_destructive_op",
  "super_admin_not_allowlisted",
  "super_admin_mfa_required",
]);

const DEFAULT_AUDIT_COLLECTION = "security_audit_events";

const DEFAULT_SECURITY_AUDIT_RETENTION_DAYS = 365;
const MIN_SECURITY_AUDIT_RETENTION_DAYS = 90;
const MAX_SECURITY_AUDIT_RETENTION_DAYS = 730;

/**
 * Retention window (in days) for `security_audit_events`, configurable via
 * `SECURITY_AUDIT_RETENTION_DAYS`. Clamped between 90 and 730 days so audit
 * trails are kept long enough for compliance but do not grow unbounded.
 */
export function getSecurityAuditRetentionDays(): number {
  const raw = String(process.env.SECURITY_AUDIT_RETENTION_DAYS || "").trim();
  if (!raw) {
    return DEFAULT_SECURITY_AUDIT_RETENTION_DAYS;
  }
  const configured = Number(raw);
  if (!Number.isFinite(configured)) {
    return DEFAULT_SECURITY_AUDIT_RETENTION_DAYS;
  }
  return Math.min(
    Math.max(Math.floor(configured), MIN_SECURITY_AUDIT_RETENTION_DAYS),
    MAX_SECURITY_AUDIT_RETENTION_DAYS,
  );
}

export function resolveSecurityAuditCollection(): string {
  return (
    String(process.env.SECURITY_AUDIT_COLLECTION || "").trim() ||
    DEFAULT_AUDIT_COLLECTION
  );
}
const DEFAULT_METRICS_COLLECTION = "security_metrics";

function observabilityEnabled(): boolean {
  return (
    String(process.env.SECURITY_OBSERVABILITY_ENABLED || "true")
      .trim()
      .toLowerCase() !== "false"
  );
}

function normalizeOptionalString(value: unknown): string | undefined {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function normalizeOptionalStatus(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  const normalized = Math.trunc(parsed);
  if (normalized < 100 || normalized > 599) return undefined;
  return normalized;
}

function getCurrentWindowId(now: Date): string {
  return now.toISOString().slice(0, 13).replace(/[-:T]/g, "");
}

function getCurrentWindowStartIso(now: Date): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 13)}:00:00.000Z`;
}

function sanitizeTenantId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "unknown";
}

function getRequestUser(req: Request): RequestUser {
  const user = (req as Request & { user?: RequestUser }).user;
  return user || {};
}

export function resolveRequestId(req: Request): string {
  const fromRequest = normalizeOptionalString(
    (req as Request & { requestId?: string }).requestId,
  );
  if (fromRequest) return fromRequest;

  const header = req.headers["x-request-id"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header) && header.length > 0) {
    const candidate = String(header[0] || "").trim();
    if (candidate) return candidate;
  }

  return randomUUID();
}

export function attachRequestId(req: Request, res: Response): string {
  const requestId = resolveRequestId(req);
  (req as Request & { requestId?: string }).requestId = requestId;
  if (!res.getHeader("x-request-id")) {
    res.setHeader("x-request-id", requestId);
  }
  return requestId;
}

export function buildSecurityLogContext(
  req: Request,
  overrides: SecurityLogContext = {},
): SecurityLogContext {
  const user = getRequestUser(req);
  return {
    requestId:
      overrides.requestId ||
      normalizeOptionalString((req as Request & { requestId?: string }).requestId) ||
      resolveRequestId(req),
    route: overrides.route || normalizeOptionalString(req.path),
    status: normalizeOptionalStatus(overrides.status),
    tenantId:
      overrides.tenantId ||
      normalizeOptionalString(user.tenantId),
    uid: overrides.uid || normalizeOptionalString(user.uid),
    eventId: normalizeOptionalString(overrides.eventId),
    reason: normalizeOptionalString(overrides.reason),
    source: normalizeOptionalString(overrides.source),
    ip: normalizeOptionalString(overrides.ip),
  };
}

export function logSecurityEvent(
  event: string,
  context: SecurityLogContext,
  level: SecurityLogLevel = "INFO",
): void {
  if (!observabilityEnabled()) return;

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event: normalizeOptionalString(event) || "unknown_event",
    requestId: normalizeOptionalString(context.requestId),
    tenantId: normalizeOptionalString(context.tenantId),
    uid: normalizeOptionalString(context.uid),
    route: normalizeOptionalString(context.route),
    status: normalizeOptionalStatus(context.status),
    eventId: normalizeOptionalString(context.eventId),
    reason: normalizeOptionalString(context.reason),
    source: normalizeOptionalString(context.source),
    ip: normalizeOptionalString(context.ip),
  };

  const logLine = `[SECURITY] ${JSON.stringify(payload)}`;
  if (level === "ERROR") {
    console.error(logLine);
    return;
  }
  if (level === "WARN") {
    console.warn(logLine);
    return;
  }
  console.log(logLine);
}

export async function incrementSecurityCounter(
  counter: SecurityCounterName,
  context: SecurityLogContext = {},
): Promise<void> {
  if (!observabilityEnabled()) return;
  if (!KNOWN_COUNTERS.has(counter)) return;

  const now = new Date();
  const windowId = getCurrentWindowId(now);
  const windowStart = getCurrentWindowStartIso(now);
  const metricsCollection =
    String(process.env.SECURITY_METRICS_COLLECTION || "").trim() ||
    DEFAULT_METRICS_COLLECTION;
  const metricsRef = db.collection(metricsCollection).doc(windowId);
  const tenantId = normalizeOptionalString(context.tenantId);

  const batch = db.batch();
  batch.set(
    metricsRef,
    {
      windowId,
      windowStart,
      updatedAt: now.toISOString(),
      counters: {
        [counter]: FieldValue.increment(1),
      },
    },
    { merge: true },
  );

  if (tenantId) {
    const tenantMetricsRef = db
      .collection(`${metricsCollection}_tenants`)
      .doc(`${windowId}_${sanitizeTenantId(tenantId)}`);
    batch.set(
      tenantMetricsRef,
      {
        windowId,
        windowStart,
        tenantId,
        updatedAt: now.toISOString(),
        counters: {
          [counter]: FieldValue.increment(1),
        },
      },
      { merge: true },
    );
  }

  try {
    await batch.commit();
  } catch (error) {
    console.warn("[SECURITY] Failed to persist security counter", {
      counter,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function writeSecurityAuditEvent(params: {
  eventType: string;
  requestId?: string;
  route?: string;
  status?: number;
  tenantId?: string;
  uid?: string;
  eventId?: string;
  reason?: string;
  source?: string;
}): Promise<void> {
  if (!observabilityEnabled()) return;

  const eventType = normalizeOptionalString(params.eventType) || "unknown";
  const auditCollection = resolveSecurityAuditCollection();

  const nowMs = Date.now();
  const expiresAt = new Date(
    nowMs + getSecurityAuditRetentionDays() * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    await db.collection(auditCollection).add({
      eventType,
      requestId: normalizeOptionalString(params.requestId) || null,
      route: normalizeOptionalString(params.route) || null,
      status: normalizeOptionalStatus(params.status) || null,
      tenantId: normalizeOptionalString(params.tenantId) || null,
      uid: normalizeOptionalString(params.uid) || null,
      eventId: normalizeOptionalString(params.eventId) || null,
      reason: normalizeOptionalString(params.reason) || null,
      source: normalizeOptionalString(params.source) || null,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt,
    });
  } catch (error) {
    console.warn("[SECURITY] Failed to persist audit event", {
      eventType,
      requestId: params.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
