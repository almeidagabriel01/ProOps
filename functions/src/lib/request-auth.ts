import { Request } from "express";
import {
  assertPrivilegedContext,
  isTenantAdminRole,
  type AuthContext,
} from "./auth-context";

function readContext(req: Request): AuthContext | null {
  const context = req.user as AuthContext | undefined;
  if (!context?.uid) return null;
  return context;
}

function requireContext(req: Request): AuthContext {
  const context = readContext(req);
  if (!context) {
    throw new Error("UNAUTHENTICATED");
  }
  return context;
}

export function getRoleClaim(req: Request): string {
  const context = readContext(req);
  return context?.role || "";
}

export function getTenantClaim(req: Request): string {
  const context = readContext(req);
  return context?.tenantId || "";
}

export function isSuperAdminClaim(req: Request): boolean {
  const context = readContext(req);
  return context?.isSuperAdmin === true;
}

export function isTenantAdminClaim(req: Request): boolean {
  const context = readContext(req);
  if (!context) return false;
  return isTenantAdminRole(context.role);
}

export function assertSuperAdminClaim(req: Request): void {
  const context = requireContext(req);
  if (!context.isSuperAdmin) {
    throw new Error("FORBIDDEN_SUPERADMIN_REQUIRED");
  }
}

export function assertTenantAdminClaim(req: Request): void {
  const context = assertPrivilegedContext(requireContext(req));
  if (!isTenantAdminRole(context.role)) {
    throw new Error("FORBIDDEN_TENANT_ADMIN_REQUIRED");
  }
}

export function assertTenantClaim(req: Request): string {
  const context = assertPrivilegedContext(requireContext(req));
  return context.tenantId;
}

export function requirePrivilegedContext(req: Request): AuthContext {
  const context = requireContext(req);
  return assertPrivilegedContext(context);
}
