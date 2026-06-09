/**
 * Which `/v1/auth/whatsapp-mfa/*` subpaths must carry the tight per-user OTP
 * limiter (`whatsappMfaLimiter`, 5/min). These are the only OTP-cost or
 * brute-force surfaces:
 *  - `/enroll`    → `/enroll/start` sends a WhatsApp template (costs money) and
 *                   `/enroll/verify` brute-forces the 6-digit code
 *  - `/challenge` → sends a login OTP
 *  - `/verify`    → brute-forces the login OTP
 *
 * `/disable` is deliberately EXCLUDED: turning OFF WhatsApp 2FA neither costs
 * money nor is brute-forceable, so it must not share the OTP budget — otherwise
 * a user who made a few OTP requests gets locked out of disabling their own 2FA
 * (429). It relies on the global protected limiter (240/min) instead. Same
 * rationale as the recovery-codes limiter (only `/verify` is tight-limited).
 */
export const WHATSAPP_MFA_OTP_LIMITED_PREFIXES = [
  "/enroll",
  "/challenge",
  "/verify",
] as const;

/**
 * True when a whatsapp-mfa subpath (relative to the `/v1/auth/whatsapp-mfa`
 * mount) is an OTP-cost / brute-force surface that needs the tight OTP limiter.
 */
export function requiresWhatsappMfaOtpLimiter(subPath: string): boolean {
  return WHATSAPP_MFA_OTP_LIMITED_PREFIXES.some(
    (prefix) => subPath === prefix || subPath.startsWith(`${prefix}/`),
  );
}
