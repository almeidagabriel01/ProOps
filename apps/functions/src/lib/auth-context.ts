import { Request } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth, db } from "../init";

const SESSION_COOKIE_NAME = "__session";
const LEGACY_COOKIE_NAME = "firebase-auth-token";
const TENANT_ADMIN_ROLES = new Set(["MASTER", "ADMIN", "WK"]);

type TokenSource = "bearer" | "session_cookie" | "legacy_cookie";

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeTenantId(value: unknown): string {
  return String(value || "").trim();
}

function normalizeOptionalString(value: unknown): string | undefined {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function parseCookieHeader(rawCookie: string | undefined): Map<string, string> {
  const cookieMap = new Map<string, string>();
  if (!rawCookie) return cookieMap;

  rawCookie
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const separatorIndex = chunk.indexOf("=");
      if (separatorIndex <= 0) return;
      const key = chunk.slice(0, separatorIndex).trim();
      const value = chunk.slice(separatorIndex + 1).trim();
      if (!key) return;
      cookieMap.set(key, decodeURIComponent(value));
    });

  return cookieMap;
}

function getCookieValue(req: Request, cookieName: string): string {
  const typedCookies = req.cookies as Record<string, string> | undefined;
  if (typedCookies && typedCookies[cookieName]) {
    return String(typedCookies[cookieName] || "").trim();
  }

  const cookieHeader = req.headers.cookie as string | string[] | undefined;
  const rawCookieHeader =
    typeof cookieHeader === "string"
      ? cookieHeader
      : Array.isArray(cookieHeader)
        ? cookieHeader.join(";")
        : "";

  const parsedCookies = parseCookieHeader(rawCookieHeader);
  return String(parsedCookies.get(cookieName) || "").trim();
}

function shouldAllowLegacyCookieFallback(): boolean {
  const defaultFallback =
    String(process.env.NODE_ENV || "").trim().toLowerCase() === "production"
      ? "false"
      : "true";
  return (
    String(process.env.AUTH_ACCEPT_LEGACY_COOKIE_HINT || defaultFallback)
      .trim()
      .toLowerCase() !== "false"
  );
}

export function shouldRequireStrictClaimsInMiddleware(): boolean {
  return (
    String(process.env.AUTH_STRICT_CLAIMS_ONLY || "")
      .trim()
      .toLowerCase() === "true"
  );
}

/**
 * Allowlist of super admins (emails and/or uids), comma-separated, read from
 * `SUPERADMIN_ALLOWLIST`. When empty/unset the allowlist is NOT enforced (no
 * demotion) — an empty allowlist must never lock everyone out.
 */
export function parseSuperAdminAllowlist(): string[] {
  return String(process.env.SUPERADMIN_ALLOWLIST || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Kill-switch for the super admin MFA (TOTP) requirement. Defaults to `false`
 * so deploying the code never locks out a super admin who has not enrolled yet;
 * flip to `true` only after enrolling MFA on the operator account.
 */
export function isSuperAdminMfaRequired(): boolean {
  return (
    String(process.env.SUPERADMIN_MFA_REQUIRED || "")
      .trim()
      .toLowerCase() === "true"
  );
}

export function extractAuthTokenFromRequest(req: Request): {
  token: string;
  source: TokenSource;
} | null {
  const authHeader = String(req.headers.authorization || "").trim();
  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice("Bearer ".length).trim();
    if (bearerToken) {
      return { token: bearerToken, source: "bearer" };
    }
  }

  const sessionCookie = getCookieValue(req, SESSION_COOKIE_NAME);
  if (sessionCookie) {
    return { token: sessionCookie, source: "session_cookie" };
  }

  if (shouldAllowLegacyCookieFallback()) {
    const legacyCookie = getCookieValue(req, LEGACY_COOKIE_NAME);
    if (legacyCookie) {
      return { token: legacyCookie, source: "legacy_cookie" };
    }
  }

  return null;
}

export interface AuthContext {
  uid: string;
  email?: string;
  email_verified?: boolean;
  role: string;
  tenantId: string;
  masterId?: string;
  stripeId?: string;
  isSuperAdmin: boolean;
  hasRequiredClaims: boolean;
  userDocTenantId?: string;
  tokenSource: TokenSource;
  mfaVerified: boolean;
  mfaRequired: boolean;
  superAdminRoleClaimed: boolean;
  superAdminAllowlisted: boolean;
  /**
   * Snapshot do doc users/{uid} lido pelo middleware de auth nesta mesma request.
   * null = doc não existe. undefined = não carregado (claims montadas manualmente).
   * Consumido por resolveUserAndTenant para evitar segunda leitura Firestore.
   */
  userDoc?: Record<string, unknown> | null;
  [key: string]: unknown;
}

type ResolveAuthContextOptions = {
  requireStrictClaims?: boolean;
};

function resolveMissingClaimsErrorCode(role: string): string {
  return role ? "AUTH_CLAIMS_MISSING_TENANT" : "AUTH_CLAIMS_MISSING_ROLE";
}

function buildMissingClaimsError(role: string): Error {
  return new Error(resolveMissingClaimsErrorCode(role));
}

export type AuthInvariantInput = {
  role: string;
  tenantId: string;
  userDocTenantId?: string;
  requireStrictClaims?: boolean;
  email?: string;
  uid?: string;
  mfaVerified?: boolean;
  superAdminAllowlist?: string[];
  requireSuperAdminMfa?: boolean;
};

export type AuthInvariantResult = {
  isSuperAdmin: boolean;
  hasRequiredClaims: boolean;
  tenantMismatch: boolean;
  missingClaimsErrorCode?: "AUTH_CLAIMS_MISSING_ROLE" | "AUTH_CLAIMS_MISSING_TENANT";
  superAdminRoleClaimed: boolean;
  superAdminAllowlisted: boolean;
  mfaVerified: boolean;
  mfaRequired: boolean;
};

function matchesSuperAdminAllowlist(
  allowlist: string[],
  email: string,
  uid: string,
): boolean {
  const emailLc = email.trim().toLowerCase();
  return allowlist.some(
    (entry) => entry === uid || entry.toLowerCase() === emailLc,
  );
}

export function evaluateAuthContextInvariants(
  input: AuthInvariantInput,
): AuthInvariantResult {
  const role = normalizeRole(input.role);
  const tenantId = normalizeTenantId(input.tenantId);
  const userDocTenantId = normalizeTenantId(input.userDocTenantId);
  const superAdminRoleClaimed = role === "SUPERADMIN";
  const isSuperAdmin = superAdminRoleClaimed;
  const hasRequiredClaims = Boolean(role) && (isSuperAdmin || Boolean(tenantId));
  const tenantMismatch =
    Boolean(tenantId) &&
    Boolean(userDocTenantId) &&
    tenantId !== userDocTenantId;
  const strict = input.requireStrictClaims === true;
  const missingClaimsErrorCode =
    strict && !hasRequiredClaims
      ? (resolveMissingClaimsErrorCode(role) as
          | "AUTH_CLAIMS_MISSING_ROLE"
          | "AUTH_CLAIMS_MISSING_TENANT")
      : undefined;

  const allowlist = input.superAdminAllowlist ?? [];
  const allowlistEnforced = superAdminRoleClaimed && allowlist.length > 0;
  const superAdminAllowlisted = allowlistEnforced
    ? matchesSuperAdminAllowlist(
        allowlist,
        String(input.email || ""),
        String(input.uid || ""),
      )
    : true;

  const mfaVerified = input.mfaVerified === true;
  const mfaRequired =
    superAdminRoleClaimed &&
    superAdminAllowlisted &&
    input.requireSuperAdminMfa === true &&
    !mfaVerified;

  return {
    isSuperAdmin,
    hasRequiredClaims,
    tenantMismatch,
    missingClaimsErrorCode,
    superAdminRoleClaimed,
    superAdminAllowlisted,
    mfaVerified,
    mfaRequired,
  };
}

/**
 * Decide se o middleware precisa buscar custom claims frescas via
 * auth.getUser() ou pode confiar nas claims embutidas no ID token verificado.
 *
 * Busca fresca quando: claims incompletas (role/tenant ausentes), role FREE
 * (upgrade pago via webhook Stripe deve refletir imediatamente, sem esperar o
 * refresh do token ~1h) ou SUPERADMIN (sensível a segurança). Para roles
 * pagas estáveis, o pior caso de token velho é um downgrade demorar <=1h —
 * coberto pelo grace period de billing. Rollback operacional sem deploy:
 * AUTH_CLAIMS_FRESHNESS=always.
 */
export function shouldFetchFreshClaims(input: {
  tokenRole: string;
  tokenTenantId: string;
  mode: string;
}): boolean {
  if (input.mode === "always") return true;
  const role = normalizeRole(input.tokenRole);
  const tenantId = normalizeTenantId(input.tokenTenantId);
  if (!role) return true;
  if (role === "SUPERADMIN") return true;
  if (role === "FREE") return true;
  if (!tenantId) return true;
  return false;
}

function resolveClaimsFreshnessMode(): string {
  return String(process.env.AUTH_CLAIMS_FRESHNESS || "auto")
    .trim()
    .toLowerCase();
}

async function decodeToken(
  token: string,
  tokenSource: TokenSource,
): Promise<DecodedIdToken> {
  if (tokenSource === "session_cookie") {
    return auth.verifySessionCookie(token, true);
  }
  return auth.verifyIdToken(token, true);
}

async function resolveAuthContextFromDecodedToken(
  decodedIdToken: DecodedIdToken,
  tokenSource: TokenSource,
  options: ResolveAuthContextOptions,
): Promise<AuthContext> {
  const tokenRole = normalizeRole(decodedIdToken.role);
  const tokenTenantId = normalizeTenantId(decodedIdToken.tenantId);

  let customClaims: {
    role?: unknown;
    tenantId?: unknown;
    masterId?: unknown;
    stripeId?: unknown;
  } = {};
  let userRecordEmail: string | undefined;

  if (
    shouldFetchFreshClaims({
      tokenRole,
      tokenTenantId,
      mode: resolveClaimsFreshnessMode(),
    })
  ) {
    const userRecord = await auth.getUser(decodedIdToken.uid);
    customClaims = (userRecord.customClaims || {}) as typeof customClaims;
    userRecordEmail = userRecord.email ?? undefined;
  }

  const role = normalizeRole(customClaims.role ?? decodedIdToken.role);
  const tenantId = normalizeTenantId(
    customClaims.tenantId ?? decodedIdToken.tenantId,
  );
  const masterId = normalizeOptionalString(
    customClaims.masterId ?? decodedIdToken.masterId,
  );
  const stripeId = normalizeOptionalString(
    customClaims.stripeId ?? decodedIdToken.stripeId,
  );

  const userSnap = await db.collection("users").doc(decodedIdToken.uid).get();
  const userData = userSnap.exists
    ? (userSnap.data() as { tenantId?: string; companyId?: string; role?: string })
    : undefined;
  const userDocTenantId = normalizeTenantId(
    userData?.tenantId || userData?.companyId,
  );

  // Fallback to Firestore user document role when claims are missing
  const effectiveRole = role || normalizeRole(userData?.role);
  const effectiveTenantId = tenantId || userDocTenantId;

  const resolvedEmail =
    normalizeOptionalString(decodedIdToken.email) ||
    normalizeOptionalString(userRecordEmail);

  const tokenMfa = (decodedIdToken.firebase || {}) as {
    sign_in_second_factor?: unknown;
  };
  const mfaVerified = Boolean(tokenMfa.sign_in_second_factor);

  const invariantResult = evaluateAuthContextInvariants({
    role: effectiveRole,
    tenantId: effectiveTenantId,
    userDocTenantId,
    requireStrictClaims: options.requireStrictClaims,
    email: resolvedEmail,
    uid: decodedIdToken.uid,
    mfaVerified,
    superAdminAllowlist: parseSuperAdminAllowlist(),
    requireSuperAdminMfa: isSuperAdminMfaRequired(),
  });

  if (invariantResult.tenantMismatch) {
    console.warn(
      `[AUTH] tenant mismatch for uid=${decodedIdToken.uid} claim=${tenantId} doc=${userDocTenantId}`,
    );
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  if (invariantResult.missingClaimsErrorCode) {
    throw buildMissingClaimsError(role);
  }

  if (
    invariantResult.superAdminRoleClaimed &&
    !invariantResult.superAdminAllowlisted
  ) {
    throw new Error("FORBIDDEN_SUPERADMIN_NOT_ALLOWLISTED");
  }

  return {
    uid: decodedIdToken.uid,
    email: resolvedEmail,
    email_verified: decodedIdToken.email_verified,
    role: effectiveRole,
    tenantId: effectiveTenantId,
    masterId,
    stripeId,
    isSuperAdmin: invariantResult.isSuperAdmin,
    hasRequiredClaims: invariantResult.hasRequiredClaims,
    userDocTenantId: userDocTenantId || undefined,
    userDoc: userSnap.exists
      ? ((userSnap.data() as Record<string, unknown>) ?? null)
      : null,
    tokenSource,
    mfaVerified: invariantResult.mfaVerified,
    mfaRequired: invariantResult.mfaRequired,
    superAdminRoleClaimed: invariantResult.superAdminRoleClaimed,
    superAdminAllowlisted: invariantResult.superAdminAllowlisted,
  };
}

export async function resolveAuthContextFromRequest(
  req: Request,
  options: ResolveAuthContextOptions = {},
): Promise<AuthContext> {
  const tokenData = extractAuthTokenFromRequest(req);
  if (!tokenData?.token) {
    throw new Error("UNAUTHENTICATED");
  }

  const decodedIdToken = await decodeToken(tokenData.token, tokenData.source);
  return resolveAuthContextFromDecodedToken(
    decodedIdToken,
    tokenData.source,
    options,
  );
}

export function assertPrivilegedContext(context: AuthContext): AuthContext {
  if (!context.uid) {
    throw new Error("UNAUTHENTICATED");
  }
  if (!context.role) {
    throw new Error("AUTH_CLAIMS_MISSING_ROLE");
  }
  if (!context.isSuperAdmin && !context.tenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }
  return context;
}

export function isTenantAdminRole(role: string): boolean {
  return role === "SUPERADMIN" || TENANT_ADMIN_ROLES.has(role);
}
