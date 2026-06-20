import { Request, Response } from "express";
import { z } from "zod";
import { auth, db } from "../../init";
import { logger } from "../../lib/logger";
import { writeSecurityAuditEvent } from "../../lib/security-observability";
import {
  hasPasswordProvider,
  isSuperAdminRole,
  verifyPasswordViaRest,
} from "./recovery-codes.controller";

/**
 * LOCAL DEV ONLY — skip the native TOTP challenge for the superadmin account.
 *
 * The softcode superadmin has the native Firebase TOTP factor enrolled, so a
 * normal client-side sign-in is blocked by the MFA challenge. This endpoint mints
 * an Admin SDK custom token (which signs in WITHOUT the native challenge) so the
 * superadmin can log in on localhost without typing the authenticator code.
 *
 * It is gated THREE independent ways and fails closed on any of them — so it can
 * never be reached in production:
 *   1. `DEV_MFA_BYPASS_ENABLED === "true"` — a flag present ONLY in
 *      `.env.erp-softcode` (dev), never in the prod env file.
 *   2. `GCLOUD_PROJECT === "erp-softcode"` — the runtime project id. Prod runs in
 *      `erp-softcode-prod`, so the equality fails there.
 *   3. The request Origin/Referer host is `localhost`/`127.0.0.1`.
 *
 * Authorization is still enforced: only a SUPERADMIN account is accepted, and the
 * password is validated against Identity Platform (password accounts). The minted
 * token carries `dev_mfa_bypass: true`, which the Firestore rules' `hasMfa()` gate
 * accepts in lieu of `sign_in_second_factor` — that claim can ONLY be obtained
 * here, so privileged client-SDK access stays MFA-gated everywhere else.
 */

const DEV_PROJECT_ID = "erp-softcode";
const GENERIC_FAILURE = "Não foi possível concluir o login.";

const bypassSchema = z.object({
  email: z.string().email().max(200).toLowerCase().trim(),
  password: z.string().min(1).max(1024),
});

/** True only in the dev project with the explicit opt-in flag set. Fails closed. */
export function isDevMfaBypassEnabled(): boolean {
  return (
    process.env.DEV_MFA_BYPASS_ENABLED === "true" &&
    process.env.GCLOUD_PROJECT === DEV_PROJECT_ID
  );
}

/**
 * True only when the request originates from a localhost page. The Next.js
 * `/api/backend` proxy strips `Origin`/`Referer` but forwards `x-forwarded-host`
 * (set to the browser host, e.g. `localhost:3000`), so that is the authoritative
 * signal here; the raw headers are kept as a fallback for direct calls.
 */
function isLocalhostHost(value: string | undefined): boolean {
  if (!value) return false;
  // value may be "localhost:3000", a bare host, or a full URL.
  const host = value.includes("://")
    ? (() => {
        try {
          return new URL(value).hostname;
        } catch {
          return "";
        }
      })()
    : value.split(":")[0].trim();
  return host === "localhost" || host === "127.0.0.1";
}

function isLocalhostOrigin(req: Request): boolean {
  const forwardedHost = req.get("x-forwarded-host");
  if (isLocalhostHost(forwardedHost)) return true;
  const origin = req.get("origin") || req.get("referer");
  return isLocalhostHost(origin);
}

/**
 * POST /v1/auth/dev-mfa-bypass — public, localhost + dev-project only.
 */
export const devMfaBypass = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  // Hard gate. A failure here is indistinguishable from "route does not exist".
  if (!isDevMfaBypassEnabled() || !isLocalhostOrigin(req)) {
    return res.status(404).json({ message: GENERIC_FAILURE });
  }

  const parsed = bypassSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: GENERIC_FAILURE });
  }

  const { email, password } = parsed.data;

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
    } catch {
      return res.status(400).json({ message: GENERIC_FAILURE });
    }

    const uid = userRecord.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.data() as
      | { tenantId?: string; role?: string }
      | undefined;

    // Superadmin ONLY — this convenience exists for the softcode superadmin.
    const claimsRole = userRecord.customClaims?.role;
    if (!isSuperAdminRole(claimsRole) && !isSuperAdminRole(userData?.role)) {
      return res.status(403).json({ message: GENERIC_FAILURE });
    }

    // Reauthenticate with the password (password accounts only). A superadmin
    // without a password provider is unexpected — refuse rather than guess.
    if (!hasPasswordProvider(userRecord.providerData) || !userRecord.email) {
      return res.status(403).json({ message: GENERIC_FAILURE });
    }
    const passwordOk = await verifyPasswordViaRest(userRecord.email, password);
    if (!passwordOk) {
      return res.status(400).json({ message: "Senha incorreta." });
    }

    const customToken = await auth.createCustomToken(uid, {
      dev_mfa_bypass: true,
    });

    void writeSecurityAuditEvent({
      eventType: "dev_mfa_bypass_signin",
      uid,
      tenantId: userData?.tenantId,
      route: req.path,
      requestId: req.requestId,
      source: "dev_mfa_bypass",
    });

    logger.warn("DEV MFA bypass used to sign in superadmin", { uid });

    return res.json({ success: true, customToken });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("devMfaBypass failed", { message });
    return res.status(400).json({ message: GENERIC_FAILURE });
  }
};
