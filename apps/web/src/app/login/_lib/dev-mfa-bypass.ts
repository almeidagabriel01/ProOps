/**
 * Pure gate for the LOCAL DEV superadmin TOTP bypass on the client side.
 *
 * The backend is authoritative (it hard-gates on the dev project + an env flag +
 * a localhost Origin), but the client must decide whether to even ATTEMPT the
 * bypass instead of showing the native TOTP screen. We only attempt it when the
 * page is served from localhost AND points at the `erp-softcode` dev project, so
 * a developer running locally against prod (or the deployed dev site) never tries.
 */
const DEV_PROJECT_ID = "erp-softcode";

export function isDevMfaBypassClientEnabled(
  hostname: string | undefined,
  projectId: string | undefined,
): boolean {
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  return isLocalhost && projectId === DEV_PROJECT_ID;
}
