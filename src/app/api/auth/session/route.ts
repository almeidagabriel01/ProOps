import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";

const SESSION_COOKIE_NAME = "__session";
const LEGACY_COOKIE_NAME = "firebase-auth-token";
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days
const MAX_REQUEST_BODY_BYTES = 8 * 1024;

// Rate limiting: 5 attempts per IP in a 15-minute sliding window
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; the first is the client
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function resolveSessionMaxAgeSeconds(): number {
  const configured = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || "");
  if (!Number.isFinite(configured)) return DEFAULT_SESSION_MAX_AGE_SECONDS;
  return Math.min(Math.max(Math.floor(configured), 60 * 10), 60 * 60 * 24 * 14);
}

function isSecureCookieRequest(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const protocol = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol;
  return String(protocol || "").toLowerCase().startsWith("https");
}

function clearLegacyCookie(response: NextResponse, req: NextRequest): void {
  response.cookies.set({
    name: LEGACY_COOKIE_NAME,
    value: "",
    httpOnly: false,
    secure: isSecureCookieRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  // Pre-check: if this IP is already blocked, reject immediately
  const preCheck = rateLimit(clientIp, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS, true);
  if (!preCheck.allowed) {
    const response = NextResponse.json(
      {
        error: "Muitas tentativas de login. Tente novamente mais tarde.",
        retryAfterSeconds: preCheck.retryAfterSeconds,
      },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(preCheck.retryAfterSeconds));
    return response;
  }

  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const body = (await req.json()) as { idToken?: string };
    const idToken = String(body?.idToken || "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "idToken is required" }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    await adminAuth.verifyIdToken(idToken, true);

    const maxAgeSeconds = resolveSessionMaxAgeSeconds();
    const expiresInMs = maxAgeSeconds * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: expiresInMs,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: isSecureCookieRequest(req),
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    });
    clearLegacyCookie(response, req);
    return response;
  } catch (error) {
    // Token verification failed — THIS counts as a failed attempt
    rateLimit(clientIp, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS);
    console.error("Failed to create session cookie:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: isSecureCookieRequest(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  clearLegacyCookie(response, req);
  return response;
}
