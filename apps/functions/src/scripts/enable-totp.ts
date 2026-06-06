/**
 * One-time setup: enables TOTP multi-factor authentication on the Firebase /
 * Identity Platform project via the Admin SDK.
 *
 * Why this exists: the Firebase/GCP console only exposes SMS-based MFA. TOTP
 * (authenticator app) MFA can ONLY be enabled programmatically, through
 * projectConfigManager().updateProjectConfig(). The project must already be
 * upgraded to Identity Platform (done in the console).
 *
 * Idempotent — re-running simply re-asserts the ENABLED state.
 *
 * Pre-requisites:
 *   1. Identity Platform enabled on the target project (console upgrade).
 *   2. Credentials — auto-loaded from apps/functions/.env.<projectId>
 *      (the same service account the functions use). No gcloud required.
 *
 * Usage (dev):
 *   cd apps/functions
 *   npx ts-node src/scripts/enable-totp.ts
 *
 * Usage (prod) — only AFTER validating in dev (bash/git-bash syntax):
 *   GCLOUD_PROJECT=erp-softcode-prod npx ts-node src/scripts/enable-totp.ts
 */

import { getAuth } from "firebase-admin/auth";
import { initScriptAdmin } from "./_script-init";

// Number of adjacent 30s windows accepted to tolerate clock skew between the
// authenticator app and the server.
const ADJACENT_INTERVALS = 5;

async function main(): Promise<void> {
  const projectId = initScriptAdmin();

  console.log(`\n=== Enable TOTP MFA ===`);
  console.log(`Project: ${projectId}`);
  console.log(`\nUpdating project config (multiFactorConfig + TOTP)...`);

  const updated = await getAuth()
    .projectConfigManager()
    .updateProjectConfig({
      multiFactorConfig: {
        state: "ENABLED",
        providerConfigs: [
          {
            state: "ENABLED",
            totpProviderConfig: { adjacentIntervals: ADJACENT_INTERVALS },
          },
        ],
      },
    });

  console.log(`\n✅ TOTP MFA enabled for ${projectId}.`);
  console.log(
    `multiFactorConfig: ${JSON.stringify(updated.multiFactorConfig, null, 2)}`,
  );
  console.log(
    `\nNext: enroll MFA on the operator account (gestao@proops.com.br) via` +
      ` /admin/setup-mfa BEFORE setting SUPERADMIN_MFA_REQUIRED=true / deploying` +
      ` the MFA-gated firestore rules in this environment.`,
  );
}

main().catch((err: Error) => {
  console.error(`\n❌ Erro fatal:`, err.message);
  process.exit(1);
});
