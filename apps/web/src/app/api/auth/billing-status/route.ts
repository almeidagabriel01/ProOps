import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Grace period matches TENANT_PLAN_PAST_DUE_GRACE_DAYS on the backend (default: 7 days).
// Keep in sync with apps/functions/src/api/middleware/require-active-subscription.ts
const PAST_DUE_GRACE_DAYS = 7;

const BLOCKED_STATUSES = new Set([
  "canceled",
  "cancelled",
  "unpaid",
  "inactive",
  "payment_failed",
]);

interface CachedBillingState {
  subscriptionStatus: string;
  pastDueSince: string | null;
  cachedAt: number;
}

// Module-level cache: survives across requests within the same warm Node.js instance.
// 30s TTL mirrors require-active-subscription.ts; max size prevents unbounded growth.
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_SIZE = 1_000;
const billingCache = new Map<string, CachedBillingState>();

function isGracePeriodActive(pastDueSince: string | null): boolean {
  if (!pastDueSince) return false;
  const referenceMs = Date.parse(pastDueSince);
  if (!Number.isFinite(referenceMs)) return false;
  const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - referenceMs <= graceMs;
}

function isBillingAllowed(
  subscriptionStatus: string,
  pastDueSince: string | null,
): boolean {
  if (
    !subscriptionStatus ||
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing"
  ) {
    return true;
  }
  if (subscriptionStatus === "past_due") {
    return isGracePeriodActive(pastDueSince);
  }
  if (BLOCKED_STATUSES.has(subscriptionStatus)) {
    return false;
  }
  // Unknown status — fail-open. Firestore rules and backend middleware are the final gate.
  return true;
}

async function resolveBillingState(tenantId: string): Promise<{
  subscriptionStatus: string;
  pastDueSince: string | null;
}> {
  const now = Date.now();
  const cached = billingCache.get(tenantId);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const db = getAdminFirestore();
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();

  if (!tenantSnap.exists) {
    return { subscriptionStatus: "", pastDueSince: null };
  }

  const data = tenantSnap.data() as Record<string, unknown> | undefined;
  // Read top-level subscriptionStatus (written by billing-claims.ts and Stripe webhook).
  // NOT the nested subscription.status — that field is legacy and may be stale.
  const subscriptionStatus = String(data?.subscriptionStatus || "")
    .trim()
    .toLowerCase();
  const pastDueSince =
    typeof data?.pastDueSince === "string" && data.pastDueSince
      ? data.pastDueSince
      : null;

  const state: CachedBillingState = { subscriptionStatus, pastDueSince, cachedAt: now };

  if (billingCache.size >= CACHE_MAX_SIZE) {
    // Evict oldest entry to keep memory bounded
    const oldestKey = billingCache.keys().next().value;
    if (oldestKey !== undefined) billingCache.delete(oldestKey);
  }
  billingCache.set(tenantId, state);

  return state;
}

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get("__session")?.value;
  if (!sessionCookie) {
    return NextResponse.json({
      allowed: false,
      status: "unauthenticated",
      reason: "no_session",
    });
  }

  try {
    const adminAuth = getAdminAuth();
    // checkRevoked: true ensures revoked tokens (canceled/unpaid via revokeRefreshTokens)
    // are rejected immediately rather than waiting for the 1-hour JWT expiry.
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

    // SuperAdmins need cross-tenant access to manage billing — never block them.
    const isSuperAdmin =
      decoded.isSuperAdmin === true ||
      String(decoded.role || "").toUpperCase() === "SUPERADMIN";
    if (isSuperAdmin) {
      return NextResponse.json({ allowed: true, status: "superadmin_bypass" });
    }

    const tenantId = String(decoded.tenantId || "").trim();
    if (!tenantId) {
      // No tenantId in claims yet (e.g., mid-onboarding) — let other layers handle it.
      return NextResponse.json({ allowed: true, status: "no_tenant" });
    }

    // Always read from Firestore — session cookie claims are embedded at cookie creation
    // time and can be stale if a Stripe webhook updated subscriptionStatus after login.
    const { subscriptionStatus, pastDueSince } =
      await resolveBillingState(tenantId);

    const allowed = isBillingAllowed(subscriptionStatus, pastDueSince);
    return NextResponse.json({ allowed, status: subscriptionStatus });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;

    if (code === "auth/session-cookie-revoked") {
      return NextResponse.json({
        allowed: false,
        status: "revoked",
        reason: "session_revoked",
      });
    }

    if (
      code === "auth/session-cookie-expired" ||
      code === "auth/argument-error"
    ) {
      return NextResponse.json({
        allowed: false,
        status: "expired",
        reason: "session_expired",
      });
    }

    // Fail open on infra errors — other layers (backend middleware, Firestore rules) catch this.
    console.error("[billing-status] unexpected error", error);
    return NextResponse.json({ allowed: true, status: "unknown" });
  }
}
