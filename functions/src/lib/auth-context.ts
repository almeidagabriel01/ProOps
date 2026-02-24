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
};

export type AuthInvariantResult = {
  isSuperAdmin: boolean;
  hasRequiredClaims: boolean;
  tenantMismatch: boolean;
  missingClaimsErrorCode?: "AUTH_CLAIMS_MISSING_ROLE" | "AUTH_CLAIMS_MISSING_TENANT";
};

export function evaluateAuthContextInvariants(
  input: AuthInvariantInput,
): AuthInvariantResult {
  const role = normalizeRole(input.role);
  const tenantId = normalizeTenantId(input.tenantId);
  const userDocTenantId = normalizeTenantId(input.userDocTenantId);
  const isSuperAdmin = role === "SUPERADMIN";
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

  return {
    isSuperAdmin,
    hasRequiredClaims,
    tenantMismatch,
    missingClaimsErrorCode,
  };
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
  const userRecord = await auth.getUser(decodedIdToken.uid);
  const customClaims = (userRecord.customClaims || {}) as {
    role?: unknown;
    tenantId?: unknown;
    masterId?: unknown;
    stripeId?: unknown;
  };

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

  const invariantResult = evaluateAuthContextInvariants({
    role: effectiveRole,
    tenantId: effectiveTenantId,
    userDocTenantId,
    requireStrictClaims: options.requireStrictClaims,
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

  return {
    uid: decodedIdToken.uid,
    email:
      normalizeOptionalString(decodedIdToken.email) ||
      normalizeOptionalString(userRecord.email),
    email_verified: decodedIdToken.email_verified,
    role: effectiveRole,
    tenantId: effectiveTenantId,
    masterId,
    stripeId,
    isSuperAdmin: invariantResult.isSuperAdmin,
    hasRequiredClaims: invariantResult.hasRequiredClaims,
    userDocTenantId: userDocTenantId || undefined,
    tokenSource,
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
