import { resolveUserAndTenant } from "../../lib/auth-helpers";

export type NotificationScope =
  | { kind: "system" }
  | { kind: "tenant"; tenantId: string };

function normalizeScopeKind(value: unknown): "system" | "tenant" | null {
  if (value === "system" || value === "tenant") {
    return value;
  }

  return null;
}

function normalizeTenantId(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export async function resolveNotificationScopeFromRequest(
  userId: string,
  claims: {
    uid?: string;
    role?: string;
    tenantId?: string;
    masterId?: string;
    [key: string]: unknown;
  },
  input: {
    scopeKind?: unknown;
    targetTenantId?: unknown;
  },
): Promise<NotificationScope> {
  const { tenantId: requesterTenantId, isSuperAdmin } = await resolveUserAndTenant(
    userId,
    claims,
  );

  const requestedScopeKind = normalizeScopeKind(input.scopeKind);
  const requestedTenantId = normalizeTenantId(input.targetTenantId);

  if (requestedScopeKind === "system") {
    if (!isSuperAdmin) {
      throw new Error("FORBIDDEN_NOTIFICATION_SCOPE");
    }

    return { kind: "system" };
  }

  if (requestedScopeKind === "tenant") {
    const tenantId = requestedTenantId || requesterTenantId;

    if (!tenantId) {
      throw new Error("NOTIFICATION_SCOPE_TENANT_REQUIRED");
    }

    if (!isSuperAdmin && tenantId !== requesterTenantId) {
      throw new Error("FORBIDDEN_NOTIFICATION_SCOPE");
    }

    return { kind: "tenant", tenantId };
  }

  if (requestedTenantId) {
    if (!isSuperAdmin && requestedTenantId !== requesterTenantId) {
      throw new Error("FORBIDDEN_NOTIFICATION_SCOPE");
    }

    return { kind: "tenant", tenantId: requestedTenantId };
  }

  if (isSuperAdmin) {
    return { kind: "system" };
  }

  if (!requesterTenantId) {
    throw new Error("NOTIFICATION_SCOPE_TENANT_REQUIRED");
  }

  return { kind: "tenant", tenantId: requesterTenantId };
}

export function getNotificationScopeTenantId(scope: NotificationScope): string {
  return scope.kind === "system" ? "system" : scope.tenantId;
}

export function isNotificationInScope(
  scope: NotificationScope,
  notification: { tenantId?: string | null },
): boolean {
  return getNotificationScopeTenantId(scope) === String(notification.tenantId || "").trim();
}
