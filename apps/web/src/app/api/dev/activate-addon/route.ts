import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

type DevAddonBody = {
  tenantId?: string;
  addonType?: string;
  action?: "activate" | "deactivate";
};

const DEV_ROUTE_RATE_LIMIT_WINDOW_MS = 60_000;
const DEV_ROUTE_RATE_LIMIT_MAX_REQUESTS = 40;
const DEV_ROUTE_MAX_BODY_BYTES = 8 * 1024;
const DEV_ROUTE_RATE_LIMIT_STATE = new Map<string, { count: number; windowStart: number }>();

function isDevRouteEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_ACTIVATE_ADDON_ROUTE === "true"
  );
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();

  if (DEV_ROUTE_RATE_LIMIT_STATE.size > 5000) {
    DEV_ROUTE_RATE_LIMIT_STATE.forEach((entry, entryKey) => {
      if (now - entry.windowStart > DEV_ROUTE_RATE_LIMIT_WINDOW_MS * 2) {
        DEV_ROUTE_RATE_LIMIT_STATE.delete(entryKey);
      }
    });
  }

  const current = DEV_ROUTE_RATE_LIMIT_STATE.get(key);
  if (!current || now - current.windowStart >= DEV_ROUTE_RATE_LIMIT_WINDOW_MS) {
    DEV_ROUTE_RATE_LIMIT_STATE.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  current.count += 1;
  DEV_ROUTE_RATE_LIMIT_STATE.set(key, current);
  if (current.count <= DEV_ROUTE_RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: true };
  }

  const retryAfterSeconds = Math.ceil(
    (DEV_ROUTE_RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1000,
  );

  return {
    allowed: false,
    retryAfterSeconds: Math.max(retryAfterSeconds, 1),
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timeoutHandle);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

async function requireSuperAdmin(request: NextRequest): Promise<{ uid: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHENTICATED");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new Error("UNAUTHENTICATED");
  }

  const adminAuth = getAdminAuth();
  const decoded = await adminAuth.verifyIdToken(token, true);
  const userRecord = await adminAuth.getUser(decoded.uid);
  const role = String(userRecord.customClaims?.role || decoded.role || "")
    .toLowerCase()
    .trim();
  if (role !== "superadmin") {
    throw new Error("FORBIDDEN");
  }

  const rateKey = `${getClientIp(request)}:${decoded.uid}`;
  const rateLimitResult = checkRateLimit(rateKey);
  if (!rateLimitResult.allowed) {
    const error = new Error("RATE_LIMITED");
    (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds =
      rateLimitResult.retryAfterSeconds;
    throw error;
  }

  return { uid: decoded.uid };
}

function validateBody(body: DevAddonBody): {
  tenantId: string;
  addonType: string;
  action: "activate" | "deactivate";
} {
  const tenantId = String(body.tenantId || "").trim();
  const addonType = String(body.addonType || "").trim();
  const action = body.action === "deactivate" ? "deactivate" : "activate";

  if (!tenantId || !addonType) {
    throw new Error("BAD_REQUEST");
  }

  return { tenantId, addonType, action };
}

function errorToResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "UNKNOWN";

  if (message === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (message === "BAD_REQUEST") {
    return NextResponse.json(
      { error: "tenantId and addonType are required" },
      { status: 400 },
    );
  }
  if (message === "RATE_LIMITED") {
    const retryAfterSeconds =
      (error as Error & { retryAfterSeconds?: number }).retryAfterSeconds || 60;
    const response = NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(retryAfterSeconds));
    return response;
  }
  if (message === "REQUEST_TIMEOUT") {
    return NextResponse.json({ error: "Request timeout" }, { status: 408 });
  }

  return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    if (!isDevRouteEnabled()) {
      return NextResponse.json({ error: "Endpoint disabled" }, { status: 403 });
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > DEV_ROUTE_MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    await requireSuperAdmin(request);
    const body = (await request.json()) as DevAddonBody;
    const { tenantId, addonType, action } = validateBody(body);
    const db = getAdminFirestore();
    const addonId = `${tenantId}_${addonType}`;
    const timeoutMs = Number(process.env.ADMIN_ROUTE_TIMEOUT_MS || 15_000);

    if (action === "activate") {
      await withTimeout(
        db.collection("addons").doc(addonId).set(
          {
            tenantId,
            addonType,
            stripeSubscriptionId: "dev_manual_activation",
            status: "active",
            purchasedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ),
        timeoutMs,
      );

      return NextResponse.json({
        success: true,
        message: `Add-on ${addonType} activated for tenant ${tenantId}`,
        addonId,
      });
    }

    await withTimeout(
      db.collection("addons").doc(addonId).set(
        {
          tenantId,
          addonType,
          status: "cancelled",
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ),
      timeoutMs,
    );

    return NextResponse.json({
      success: true,
      message: `Add-on ${addonType} deactivated for tenant ${tenantId}`,
      addonId,
    });
  } catch (error) {
    return errorToResponse(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!isDevRouteEnabled()) {
      return NextResponse.json({ error: "Endpoint disabled" }, { status: 403 });
    }

    await requireSuperAdmin(request);
    const { searchParams } = new URL(request.url);
    const tenantId = String(searchParams.get("tenantId") || "").trim();
    if (!tenantId) {
      return NextResponse.json(
        { error: "tenantId query param is required" },
        { status: 400 },
      );
    }

    const db = getAdminFirestore();
    const timeoutMs = Number(process.env.ADMIN_ROUTE_TIMEOUT_MS || 15_000);
    const snapshot = await withTimeout(
      db.collection("addons").where("tenantId", "==", tenantId).get(),
      timeoutMs,
    );

    const addons = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return NextResponse.json({ tenantId, addons });
  } catch (error) {
    return errorToResponse(error);
  }
}
