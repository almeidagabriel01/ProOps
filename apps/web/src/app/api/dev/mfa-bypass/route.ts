import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

/**
 * LOCAL DEV ONLY — skip the native TOTP challenge for the softcode superadmin.
 *
 * This runs in the Next.js server, which during local development executes on
 * the developer's machine (`NODE_ENV === "development"`). On Vercel (preview AND
 * production) `NODE_ENV === "production"`, so the route is a hard 403 there — the
 * gate is a server-side runtime signal, NOT a request header, so it cannot be
 * spoofed by a caller hitting a deployed URL.
 *
 * Critically, it is SESSION-SCOPED: it mints a short-lived custom token carrying
 * a `dev_mfa_bypass` claim and does NOT mutate the account (the native TOTP
 * factor stays enrolled). So a preview/prod login still faces the real MFA
 * challenge — only the local session is bypassed. The Firestore rules' `hasMfa()`
 * gate accepts the claim, which is only ever minted here (a dev-gated route), so
 * privileged client-SDK access stays MFA-gated everywhere else.
 *
 * It also self-heals the earlier (now-removed) account-mutation approach: if the
 * account carries a PERSISTENT `dev_mfa_bypass` custom claim, it is stripped here
 * so it stops granting access on deployed environments.
 */

const DEV_PROJECT_ID = "erp-softcode";
const GENERIC_FAILURE = "Não foi possível concluir o login.";
const MAX_BODY_BYTES = 8 * 1024;

interface BypassBody {
  email?: string;
  password?: string;
}

function isDevMfaBypassRouteEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ENABLE_DEV_MFA_BYPASS_ROUTE === "true" &&
    (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "") === DEV_PROJECT_ID
  );
}

function isSuperAdminRole(role: unknown): boolean {
  return typeof role === "string" && role.toUpperCase() === "SUPERADMIN";
}

/**
 * Verify the password against Identity Platform (or the Auth emulator when one is
 * running). A correct password returns HTTP 200 — with an idToken, or with an
 * mfaPendingCredential when MFA is enrolled; both 200 shapes prove the password.
 */
async function verifyPassword(email: string, password: string): Promise<boolean> {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const apiKey =
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    (emulatorHost ? "fake-api-key" : undefined);
  if (!apiKey) return false;

  const baseUrl = emulatorHost
    ? `http://${emulatorHost}/identitytoolkit.googleapis.com`
    : "https://identitytoolkit.googleapis.com";

  const response = await fetch(
    `${baseUrl}/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      cache: "no-store",
    },
  );
  return response.status === 200;
}

export async function POST(req: NextRequest) {
  // Hard gate. A failure here is indistinguishable from "route disabled".
  if (!isDevMfaBypassRouteEnabled()) {
    return NextResponse.json({ message: GENERIC_FAILURE }, { status: 403 });
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "Payload too large" }, { status: 413 });
  }

  let body: BypassBody;
  try {
    body = (await req.json()) as BypassBody;
  } catch {
    return NextResponse.json({ message: GENERIC_FAILURE }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password) {
    return NextResponse.json({ message: GENERIC_FAILURE }, { status: 400 });
  }

  try {
    const adminAuth = getAdminAuth();

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch {
      return NextResponse.json({ message: GENERIC_FAILURE }, { status: 400 });
    }

    const uid = userRecord.uid;
    const userSnap = await getAdminFirestore().collection("users").doc(uid).get();
    const docRole = (userSnap.data() as { role?: string } | undefined)?.role;

    // Superadmin ONLY.
    const claimsRole = userRecord.customClaims?.role;
    if (!isSuperAdminRole(claimsRole) && !isSuperAdminRole(docRole)) {
      return NextResponse.json({ message: GENERIC_FAILURE }, { status: 403 });
    }

    if (!userRecord.email) {
      return NextResponse.json({ message: GENERIC_FAILURE }, { status: 403 });
    }
    const passwordOk = await verifyPassword(userRecord.email, password);
    if (!passwordOk) {
      return NextResponse.json({ message: "Senha incorreta." }, { status: 400 });
    }

    // Self-heal: strip any PERSISTENT dev_mfa_bypass claim left on the account by
    // the earlier (removed) approach so it stops granting access on deployed
    // environments. The bypass is session-scoped via the custom token below.
    const existingClaims = userRecord.customClaims ?? {};
    if (existingClaims.dev_mfa_bypass !== undefined) {
      const { dev_mfa_bypass: _drop, ...rest } = existingClaims as Record<
        string,
        unknown
      >;
      void _drop;
      await adminAuth.setCustomUserClaims(uid, rest);
    }

    // Session-scoped claim: lives only in this custom token, not on the account.
    const customToken = await adminAuth.createCustomToken(uid, {
      dev_mfa_bypass: true,
    });

    return NextResponse.json({ success: true, customToken });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("dev-mfa-bypass route failed:", detail);
    return NextResponse.json(
      { message: `${GENERIC_FAILURE} (${detail})` },
      { status: 500 },
    );
  }
}
