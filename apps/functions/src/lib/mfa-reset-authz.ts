/**
 * Pure authorization decision for the "reset member MFA" recovery endpoint.
 * Extracted from the controller so the security rules can be unit-tested without
 * the controller's Firebase/Stripe import chain.
 *
 * Rule: super admins may reset any user; tenant admins may only reset members
 * of their own tenant (same tenantId) whose master is the requester.
 */

export interface MfaResetTarget {
  exists: boolean;
  tenantId?: string;
  masterId?: string;
}

export interface MfaResetAuthzInput {
  isSuperAdmin: boolean;
  isTenantAdmin: boolean;
  requesterUid: string;
  requesterTenantId: string;
  target: MfaResetTarget;
}

export type MfaResetAuthzResult =
  | { allowed: true }
  | { allowed: false; status: 403 | 404; message: string; crossTenant?: boolean };

export function authorizeMfaReset(
  input: MfaResetAuthzInput,
): MfaResetAuthzResult {
  if (!input.target.exists) {
    return { allowed: false, status: 404, message: "Usuário não encontrado." };
  }

  if (input.isSuperAdmin) {
    return { allowed: true };
  }

  if (!input.isTenantAdmin) {
    return { allowed: false, status: 403, message: "Permissão negada." };
  }

  if (input.target.tenantId !== input.requesterTenantId) {
    return {
      allowed: false,
      status: 403,
      message: "Permissão negada.",
      crossTenant: true,
    };
  }

  if (input.target.masterId !== input.requesterUid) {
    return { allowed: false, status: 403, message: "Permissão negada." };
  }

  return { allowed: true };
}
