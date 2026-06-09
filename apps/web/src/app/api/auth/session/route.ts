import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rate-limit";
import { resolveFunctionsApiUpstream } from "@/lib/server-api-upstream";
import {
  decideWhatsappGate,
  type WhatsappChallengeResult,
} from "./_lib/whatsapp-gate";
import { decideSessionVerification } from "./_lib/session-verification";

const SESSION_COOKIE_NAME = "__session";
const LEGACY_COOKIE_NAME = "firebase-auth-token";
const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 days
const MAX_REQUEST_BODY_BYTES = 8 * 1024;

// Rate limiting: 5 attempts per IP in a 15-minute sliding window
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// WhatsApp-MFA gate: server-to-server calls to Cloud Functions. Keep a short
// timeout so a slow/unreachable backend cannot stall the login indefinitely —
// on failure the challenge step fails OPEN (see decideWhatsappGate usage).
const WHATSAPP_MFA_TIMEOUT_MS = 8_000;

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

function parseSuperAdminAllowlist(): string[] {
  return String(process.env.SUPERADMIN_ALLOWLIST || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isSuperAdminMfaRequired(): boolean {
  return (
    String(process.env.SUPERADMIN_MFA_REQUIRED || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function isAllowlisted(allowlist: string[], email: string, uid: string): boolean {
  const emailLc = String(email || "").trim().toLowerCase();
  return allowlist.some(
    (entry) => entry === uid || entry.toLowerCase() === emailLc,
  );
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

function buildWhatsappMfaUrl(req: NextRequest, endpoint: "challenge" | "verify"): string {
  const { baseUrl } = resolveFunctionsApiUpstream(req);
  return `${baseUrl}/v1/auth/whatsapp-mfa/${endpoint}`;
}

/**
 * Calls the backend WhatsApp-MFA challenge with the user's ID token. Returns the
 * parsed challenge result, or `null` when the call fails in a non-fatal way
 * (network error, timeout, non-2xx). Returning `null` makes the gate fail OPEN:
 * WhatsApp-MFA is opt-in and the gate is "soft", so backend unavailability must
 * not lock users out of login — but the error IS logged for observability.
 */
async function requestWhatsappChallenge(
  req: NextRequest,
  idToken: string,
  resend?: boolean,
): Promise<WhatsappChallengeResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHATSAPP_MFA_TIMEOUT_MS);
  try {
    const upstreamResponse = await fetch(buildWhatsappMfaUrl(req, "challenge"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ resend: Boolean(resend) }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!upstreamResponse.ok) {
      console.error(
        "WhatsApp MFA challenge returned non-OK status:",
        upstreamResponse.status,
      );
      return null;
    }
    return (await upstreamResponse.json()) as WhatsappChallengeResult;
  } catch (error) {
    console.error("WhatsApp MFA challenge request failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

interface WhatsappVerifyOutcome {
  verified: boolean;
  status: number;
  body: Record<string, unknown>;
}

/**
 * Calls the backend WhatsApp-MFA verify with the user's ID token and OTP code.
 * Unlike the challenge step, verification does NOT fail open: a failed/errored
 * verify must withhold the cookie. The backend's status and body are forwarded
 * to the client so it can surface `attemptsLeft`/`message`.
 */
async function requestWhatsappVerify(
  req: NextRequest,
  idToken: string,
  code: string,
): Promise<WhatsappVerifyOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHATSAPP_MFA_TIMEOUT_MS);
  try {
    const upstreamResponse = await fetch(buildWhatsappMfaUrl(req, "verify"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ code }),
      cache: "no-store",
      signal: controller.signal,
    });
    const json = (await upstreamResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return {
      verified: upstreamResponse.ok && json?.verified === true,
      status: upstreamResponse.status,
      body: json,
    };
  } catch (error) {
    console.error("WhatsApp MFA verify request failed:", error);
    return {
      verified: false,
      status: 502,
      body: { message: "Não foi possível verificar o código. Tente novamente." },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calls the backend recovery-codes verify with the user's ID token and a
 * one-time recovery code. Like the WhatsApp verify, this does NOT fail open: a
 * failed/errored verify must withhold the cookie. The backend returns
 * `{ verified: true, remaining }` on success or 400 `{ verified: false, message }`
 * on failure; the status/body are forwarded so the client can surface `message`.
 */
async function requestRecoveryCodeVerify(
  req: NextRequest,
  idToken: string,
  code: string,
): Promise<WhatsappVerifyOutcome> {
  const { baseUrl } = resolveFunctionsApiUpstream(req);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHATSAPP_MFA_TIMEOUT_MS);
  try {
    const upstreamResponse = await fetch(
      `${baseUrl}/v1/auth/recovery-codes/verify`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    const json = (await upstreamResponse.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    return {
      verified: upstreamResponse.ok && json?.verified === true,
      status: upstreamResponse.status,
      body: json,
    };
  } catch (error) {
    console.error("Recovery code verify request failed:", error);
    return {
      verified: false,
      status: 502,
      body: { message: "Não foi possível verificar o código. Tente novamente." },
    };
  } finally {
    clearTimeout(timeout);
  }
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

    const body = (await req.json()) as {
      idToken?: string;
      otpCode?: string;
      recoveryCode?: string;
      resend?: boolean;
    };
    const idToken = String(body?.idToken || "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "idToken is required" }, { status: 400 });
    }
    const otpCode = String(body?.otpCode || "").trim();
    const recoveryCode = String(body?.recoveryCode || "").trim();
    const resend = body?.resend === true;

    const adminAuth = getAdminAuth();
    // When running against the Firebase Auth emulator the ID tokens returned
    // by the emulator are unsigned (no "kid") and cannot be verified with
    // checkRevoked=true. Detect emulator mode and avoid the extra revoked
    // check there while keeping strict verification in production.
    const isEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
    const decoded = await adminAuth.verifyIdToken(idToken, isEmulator ? false : true);

    // Defense-in-depth super admin gates (the backend middleware is authoritative).
    const role = String((decoded as { role?: unknown }).role || "")
      .trim()
      .toUpperCase();
    const isSuperAdminRole = role === "SUPERADMIN";

    if (isSuperAdminRole) {
      const allowlist = parseSuperAdminAllowlist();
      if (
        allowlist.length > 0 &&
        !isAllowlisted(allowlist, String(decoded.email || ""), decoded.uid)
      ) {
        return NextResponse.json(
          { error: "Super admin não autorizado.", code: "SUPERADMIN_NOT_ALLOWLISTED" },
          { status: 403 },
        );
      }
    }

    const secondFactor = (
      decoded.firebase as { sign_in_second_factor?: unknown } | undefined
    )?.sign_in_second_factor;
    // `recover-totp` mints the custom token with this developer claim. A login
    // completed via a one-time recovery code already cleared 2FA, so the
    // WhatsApp gate below must be skipped (a recovery code is a full bypass).
    const recoveryLogin =
      (decoded as { recovery_login?: unknown }).recovery_login === true;
    const mfaRequired =
      isSuperAdminRole && isSuperAdminMfaRequired() && !secondFactor;

    // Whether this request is a background re-sync of an ALREADY authenticated
    // session (token refresh / visibilitychange / startup re-POST the idToken
    // with `credentials: include`). When the request carries a valid __session
    // cookie for the SAME user, the OTP gate — a LOGIN step — must be skipped so
    // re-syncs don't send unsolicited WhatsApp OTPs and burn the rate limit.
    // Best-effort only: any error/absence falls back to `false` (treat as login).
    let alreadyAuthenticated = false;
    const existingCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (existingCookie) {
      try {
        const sessionDecoded = await adminAuth.verifySessionCookie(
          existingCookie,
          true,
        );
        if (sessionDecoded.uid === decoded.uid) {
          alreadyAuthenticated = true;
        }
      } catch {
        alreadyAuthenticated = false;
      }
    }

    // --- WhatsApp-MFA gate (custom, opt-in) ---
    // Runs in parallel to the super admin gate above and is purely additive.
    // Second step: the client re-POSTed a verification input. Verify it with the
    // backend BEFORE creating the session cookie. Both the WhatsApp OTP and the
    // recovery-code paths are fail-closed: a failed verify withholds the cookie
    // and forwards the backend's status/message.
    const verificationPath = decideSessionVerification({ otpCode, recoveryCode });
    if (verificationPath === "otp") {
      const verifyOutcome = await requestWhatsappVerify(req, idToken, otpCode);
      if (!verifyOutcome.verified) {
        const status =
          verifyOutcome.status >= 400 && verifyOutcome.status < 600
            ? verifyOutcome.status
            : 400;
        return NextResponse.json(verifyOutcome.body, { status });
      }
      // verified === true → fall through to normal cookie emission below.
    } else if (verificationPath === "recovery-code") {
      const verifyOutcome = await requestRecoveryCodeVerify(
        req,
        idToken,
        recoveryCode,
      );
      if (!verifyOutcome.verified) {
        const status =
          verifyOutcome.status >= 400 && verifyOutcome.status < 600
            ? verifyOutcome.status
            : 400;
        return NextResponse.json(verifyOutcome.body, { status });
      }
      // verified === true → fall through to normal cookie emission below.
    } else if (
      !isSuperAdminRole &&
      !secondFactor &&
      !recoveryLogin &&
      !alreadyAuthenticated
    ) {
      // First step of LOGIN: no OTP yet, not a super admin, no native second
      // factor already satisfied, and NOT a re-sync of an existing authenticated
      // session. Ask the backend whether this user requires WhatsApp OTP. On a
      // non-fatal failure the challenge result is null → fail open.
      const challenge = await requestWhatsappChallenge(req, idToken, resend);
      const decision = decideWhatsappGate({
        isSuperAdmin: isSuperAdminRole,
        hasNativeSecondFactor: Boolean(secondFactor),
        recoveryLogin,
        alreadyAuthenticated,
        challenge,
      });
      if (decision === "require") {
        // Withhold the __session cookie until the OTP is verified.
        return NextResponse.json({
          success: true,
          mfaRequired: true,
          method: "whatsapp",
          maskedPhone: challenge?.maskedPhone,
          otpSent: challenge?.otpSent,
          retryAfterSeconds: challenge?.retryAfterSeconds,
        });
      }
    }
    // --- end WhatsApp-MFA gate ---

    const maxAgeSeconds = resolveSessionMaxAgeSeconds();
    const expiresInMs = maxAgeSeconds * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: expiresInMs,
    });

    const response = NextResponse.json({ success: true, mfaRequired });
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
