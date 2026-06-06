import type { Request } from "express";
import { db } from "../init";
import {
  incrementSecurityCounter,
  writeSecurityAuditEvent,
} from "./security-observability";

const TENANT_EXISTENCE_CACHE_TTL_MS = 60_000;

// tenantId -> expiry timestamp (ms). Only positive lookups are cached, so a
// tenant that does not exist is always re-checked.
const tenantExistenceCache = new Map<string, number>();

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

async function tenantExists(tenantId: string): Promise<boolean> {
  // Canonical doc first (cheapest), then `companies` and finally a bounded
  // users query — covers legacy tenants that may lack a `tenants` document.
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (tenantSnap.exists) return true;

  const companySnap = await db.collection("companies").doc(tenantId).get();
  if (companySnap.exists) return true;

  const userSnap = await db
    .collection("users")
    .where("tenantId", "==", tenantId)
    .limit(1)
    .get();
  return !userSnap.empty;
}

/**
 * Confirms a tenantId refers to a real tenant before a super admin operates on
 * it. Positive results are cached briefly to avoid repeated reads during an
 * impersonation session. Throws (message includes "inválida") when the tenant
 * cannot be found — controllers map this to HTTP 400.
 */
export async function assertTenantExists(tenantId: string): Promise<void> {
  const normalized = normalize(tenantId);
  if (!normalized) {
    throw new Error("Empresa inválida ou inexistente.");
  }

  const cachedExpiry = tenantExistenceCache.get(normalized);
  if (cachedExpiry && cachedExpiry > Date.now()) {
    return;
  }

  const exists = await tenantExists(normalized);
  if (!exists) {
    throw new Error("Empresa inválida ou inexistente.");
  }

  tenantExistenceCache.set(
    normalized,
    Date.now() + TENANT_EXISTENCE_CACHE_TTL_MS,
  );
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface SuperAdminWriteAuditParams {
  uid?: string;
  tenantId: string;
  route?: string;
  requestId?: string;
}

/**
 * Records a single audit event for a super admin write performed against
 * another tenant (impersonation). Fire-and-forget: never blocks or throws into
 * the request path. Callers invoke this only when a super admin is acting on a
 * tenant other than their own.
 */
export function auditSuperAdminCrossTenantWrite(
  params: SuperAdminWriteAuditParams,
): void {
  const uid = normalize(params.uid);
  const tenantId = normalize(params.tenantId);
  const route = normalize(params.route) || undefined;
  void writeSecurityAuditEvent({
    eventType: "super_admin_tenant_write",
    uid,
    tenantId,
    route,
    requestId: params.requestId,
    source: "super_admin_impersonation",
  });
  void incrementSecurityCounter("super_admin_tenant_write", {
    uid,
    tenantId,
    route,
    requestId: params.requestId,
  });
}

export interface ResolveTenantOptions {
  bodyTargetTenantId?: string;
}

export interface ResolvedTenant {
  tenantId: string;
  impersonated: boolean;
}

/**
 * Resolves the effective tenant for a request and validates any super-admin
 * cross-tenant override (header `x-tenant-id` or body `targetTenantId`).
 *
 * - Regular users always resolve to their own claim tenant; header/body
 *   overrides are ignored.
 * - Super admins may target another tenant, but the target must exist
 *   (`assertTenantExists`). Cross-tenant writes are audited at this single
 *   choke point.
 */
export async function resolveEffectiveTenantId(
  req: Request,
  options: ResolveTenantOptions = {},
): Promise<ResolvedTenant> {
  const user = req.user;
  const ownTenantId = normalize(user?.tenantId);

  if (!user?.isSuperAdmin) {
    return { tenantId: ownTenantId, impersonated: false };
  }

  const headerTenantId = normalize(req.headers["x-tenant-id"]);
  const bodyTenantId = normalize(options.bodyTargetTenantId);
  const candidate = headerTenantId || bodyTenantId;

  if (!candidate) {
    return { tenantId: ownTenantId, impersonated: false };
  }

  await assertTenantExists(candidate);

  const impersonated = candidate !== ownTenantId;

  if (
    impersonated &&
    MUTATING_METHODS.has(String(req.method || "").toUpperCase())
  ) {
    auditSuperAdminCrossTenantWrite({
      uid: normalize(user.uid),
      tenantId: candidate,
      route: req.originalUrl || req.path,
      requestId: req.requestId,
    });
  }

  return { tenantId: candidate, impersonated };
}
