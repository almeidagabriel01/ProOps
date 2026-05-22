import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";
import { unstable_cache } from "next/cache";
import { isFreeTierAllowedPath } from "@/lib/auth/resolve-user-home";

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

// 60-second TTL backed by Next.js Data Cache (shared across Vercel instances).
// Invalidated immediately after billing state changes via revalidateTag in the
// /api/auth/billing-status/invalidate endpoint (called by the backend webhook handler).
const BILLING_CACHE_TTL_SECONDS = 60;

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

function createBillingStateFetcher(tenantId: string) {
  return unstable_cache(
    async () => {
      const db = getAdminFirestore();
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      if (!tenantSnap.exists) {
        return { subscriptionStatus: "", plan: "", pastDueSince: null };
      }
      const data = tenantSnap.data() as Record<string, unknown> | undefined;
      const subscriptionStatus = String(data?.subscriptionStatus || "").trim().toLowerCase();
      const plan = String(data?.plan || "").trim().toLowerCase();
      const pastDueSince =
        typeof data?.pastDueSince === "string" && data.pastDueSince ? data.pastDueSince : null;
      return { subscriptionStatus, plan, pastDueSince };
    },
    [`billing-state-${tenantId}`],
    { revalidate: BILLING_CACHE_TTL_SECONDS, tags: [`billing-status:${tenantId}`] },
  );
}

async function resolveBillingState(tenantId: string): Promise<{
  subscriptionStatus: string;
  plan: string;
  pastDueSince: string | null;
}> {
  return createBillingStateFetcher(tenantId)();
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
    const { subscriptionStatus, plan, pastDueSince } =
      await resolveBillingState(tenantId);

    // Free tier guard: regardless of subscriptionStatus, a free tenant can
    // only navigate to /, /subscribe, /profile, /checkout-success and
    // /subscription-blocked. Any other path (including /dashboard and the
    // entire ERP) is blocked at the middleware boundary before the page
    // is rendered. The path is forwarded by the middleware as ?path=.
    const requestedPath = req.nextUrl.searchParams.get("path") || "";
    const isFreeTier =
      plan === "free" ||
      subscriptionStatus === "free" ||
      String(decoded.role || "").toLowerCase() === "free";
    if (isFreeTier && requestedPath && !isFreeTierAllowedPath(requestedPath)) {
      return NextResponse.json({
        allowed: false,
        status: "free",
        reason: "free_tier_forbidden",
      });
    }

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

    // Fail closed on infra errors. Previously we returned allowed:true on
    // unexpected errors so an outage wouldn't lock anyone out — but that
    // meant a free user could reach the ERP whenever the cookie verifier
    // failed transiently. Bounce to subscription-blocked instead; the user
    // can refresh or try again.
    console.error("[billing-status] unexpected error", error);
    return NextResponse.json({
      allowed: false,
      status: "error",
      reason: "billing_check_failed",
    });
  }
}
