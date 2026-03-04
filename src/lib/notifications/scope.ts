"use client";

export type NotificationScope =
  | { kind: "system" }
  | { kind: "tenant"; tenantId: string };

interface ResolveNotificationScopeInput {
  pathname?: string | null;
  userRole?: string | null;
  userTenantId?: string | null;
  viewingTenantId?: string | null;
}

function normalizeTenantId(value?: string | null): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function isSuperAdminRole(role?: string | null): boolean {
  return String(role || "").trim().toLowerCase() === "superadmin";
}

export function resolveNotificationScope(
  input: ResolveNotificationScopeInput,
): NotificationScope | null {
  const isSuperAdmin = isSuperAdminRole(input.userRole);
  const pathname = input.pathname || "";
  const viewingTenantId = normalizeTenantId(input.viewingTenantId);
  const userTenantId = normalizeTenantId(input.userTenantId);

  if (isSuperAdmin && pathname.startsWith("/admin")) {
    return { kind: "system" };
  }

  if (isSuperAdmin) {
    return viewingTenantId ? { kind: "tenant", tenantId: viewingTenantId } : { kind: "system" };
  }

  if (userTenantId) {
    return { kind: "tenant", tenantId: userTenantId };
  }

  return viewingTenantId ? { kind: "tenant", tenantId: viewingTenantId } : null;
}

export function getNotificationScopeKey(scope: NotificationScope | null): string | null {
  if (!scope) {
    return null;
  }

  return scope.kind === "system" ? "system" : `tenant:${scope.tenantId}`;
}

export function appendNotificationScopeSearchParams(
  params: URLSearchParams,
  scope: NotificationScope,
): URLSearchParams {
  params.set("scopeKind", scope.kind);

  if (scope.kind === "tenant") {
    params.set("targetTenantId", scope.tenantId);
  } else {
    params.delete("targetTenantId");
  }

  return params;
}
