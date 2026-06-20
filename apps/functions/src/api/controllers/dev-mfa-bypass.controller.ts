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
 * never be reached on a deployed backend (prod, dev, or a Vercel preview that
 * proxies to the deployed dev functions):
 *   1. `FUNCTIONS_EMULATOR === "true"` — the AUTHORITATIVE gate. This is set only
 *      by the local Firebase emulator runtime and NEVER on deployed Cloud
 *      Functions/Run. It is a server-side runtime signal, not a request header,
 *      so it cannot be spoofed by a client (unlike an Origin/X-Forwarded-Host
 *      check, which a caller hitting the public dev URL could forge).
 *   2. `DEV_MFA_BYPASS_ENABLED === "true"` — an explicit opt-in flag present only
 *      in `.env.erp-softcode`, so the bypass isn't silently active for everyone
 *      running the emulator.
 *   3. `GCLOUD_PROJECT === "erp-softcode"` — guards against running the emulator
 *      against another project.
 *
 * Authorization is still enforced: only a SUPERADMIN account is accepted, and the
 * password is validated against Identity Platform (password accounts).
 *
 * Rather than minting a custom token (which requires a local signing credential
 * the dev machine doesn't have), it performs two Admin SDK writes — which work
 * with ambient gcloud ADC, NO private key needed:
 *   1. Unenrolls the native TOTP factor, so a plain password sign-in is no longer
 *      blocked by the MFA challenge.
 *   2. Sets the `dev_mfa_bypass: true` custom claim (merged with existing claims),
 *      which the Firestore rules' `hasMfa()` gate accepts in lieu of
 *      `sign_in_second_factor` — so the now-single-factor superadmin keeps full
 *      privileged client-SDK access. That claim is only ever set here.
 *
 * The client then simply retries the email/password sign-in. The change persists
 * on the dev account, so subsequent logins need no second factor (the endpoint is
 * idempotent — re-running it is a no-op on an already-unenrolled account).
 */

const DEV_PROJECT_ID = "erp-softcode";
const GENERIC_FAILURE = "Não foi possível concluir o login.";

const bypassSchema = z.object({
  email: z.string().email().max(200).toLowerCase().trim(),
  password: z.string().min(1).max(1024),
});

/**
 * The authoritative gate: true only inside the local Firebase emulator runtime
 * AND with the explicit opt-in flag set, in the dev project. `FUNCTIONS_EMULATOR`
 * is a runtime env the emulator sets and deployed Cloud Functions never do — it
 * cannot be spoofed by a request, so a deployed backend (prod/dev/preview) can
 * never satisfy this. Fails closed.
 */
export function isDevMfaBypassEnabled(): boolean {
  return (
    process.env.FUNCTIONS_EMULATOR === "true" &&
    process.env.DEV_MFA_BYPASS_ENABLED === "true" &&
    process.env.GCLOUD_PROJECT === DEV_PROJECT_ID
  );
}

/**
 * POST /v1/auth/dev-mfa-bypass — public, localhost + dev-project only.
 */
export const devMfaBypass = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  // Hard gate. A failure here is indistinguishable from "route does not exist".
  if (!isDevMfaBypassEnabled()) {
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

    // Unenroll all native MFA factors (TOTP) so the password sign-in is no longer
    // challenged, and set the dev_mfa_bypass claim (merged) so the Firestore rules
    // still grant superadmin access. Both are plain Admin writes — no signing.
    try {
      await auth.updateUser(uid, { multiFactor: { enrolledFactors: null } });
      await auth.setCustomUserClaims(uid, {
        ...(userRecord.customClaims ?? {}),
        dev_mfa_bypass: true,
      });
    } catch (writeError: unknown) {
      const detail =
        writeError instanceof Error ? writeError.message : String(writeError);
      logger.error("devMfaBypass: account update failed", { uid, detail });
      // Dev/localhost-only endpoint — safe to surface the real reason.
      return res
        .status(500)
        .json({ message: `Falha ao preparar a conta para o bypass: ${detail}` });
    }

    void writeSecurityAuditEvent({
      eventType: "dev_mfa_bypass_prepared",
      uid,
      tenantId: userData?.tenantId,
      route: req.path,
      requestId: req.requestId,
      source: "dev_mfa_bypass",
    });

    logger.warn("DEV MFA bypass: unenrolled TOTP + set claim for superadmin", {
      uid,
    });

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logger.error("devMfaBypass failed", { message });
    return res.status(400).json({ message: GENERIC_FAILURE });
  }
};
