/**
 * Quem está na tela `/subscription-blocked`: papel, empresa e responsável.
 * Puro, lido por `app/subscription-blocked/_lib/blocked-session.ts`.
 *
 * O doc `users/{uid}` vence as claims da sessão. É ele que o login
 * (`resolveUserHome`) e o `SubscriptionGuard` leem para mandar a pessoa até
 * aqui, então a tela tem que concordar com eles. Lendo só as claims, uma conta
 * com claim vazia (sem `tenantId`) ou `free` e doc de dono era devolvida à
 * landing sem mensagem nenhuma: foi o que aconteceu com uma conta montada à
 * mão em produção quando o super admin encerrou o acesso dela. As claims só
 * preenchem o que o doc não tem.
 */

export interface BlockedSessionClaims {
  [claim: string]: unknown;
  role?: unknown;
  tenantId?: unknown;
  masterId?: unknown;
  isSuperAdmin?: unknown;
}

export interface BlockedSessionUserDoc {
  role?: unknown;
  tenantId?: unknown;
  companyId?: unknown;
  masterId?: unknown;
}

export interface BlockedSessionIdentity {
  /** Em maiúsculas: `MASTER`, `ADMIN`, `MEMBER`, `FREE`, `SUPERADMIN`... */
  role: string;
  tenantId: string;
  masterId: string;
  isSuperAdmin: boolean;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveBlockedSessionIdentity(
  claims: BlockedSessionClaims,
  userDoc: BlockedSessionUserDoc | null,
): BlockedSessionIdentity {
  const role = (text(userDoc?.role) || text(claims.role)).toUpperCase();
  return {
    role,
    tenantId: text(userDoc?.tenantId) || text(userDoc?.companyId) || text(claims.tenantId),
    masterId: text(userDoc?.masterId) || text(claims.masterId),
    isSuperAdmin:
      claims.isSuperAdmin === true || role === "SUPERADMIN" || text(claims.role).toUpperCase() === "SUPERADMIN",
  };
}
