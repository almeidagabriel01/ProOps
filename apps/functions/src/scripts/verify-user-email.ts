/**
 * Marks a user's email as verified via the Admin SDK (sets emailVerified=true).
 * Needed e.g. to enroll TOTP MFA on an account whose email cannot receive the
 * verification link (Firebase requires a verified email before MFA enrollment).
 *
 * Does NOT change the email or send anything — it only flips the flag.
 *
 * Credentials — auto-loaded from apps/functions/.env.<projectId> if it has a
 * service account, else GOOGLE_APPLICATION_CREDENTIALS. No gcloud required.
 *
 * Usage (target = email or uid, via arg or TARGET env):
 *   cd apps/functions
 *   export GOOGLE_APPLICATION_CREDENTIALS="C:/path/to/serviceAccount.json"
 *   npx ts-node src/scripts/verify-user-email.ts super-admin@exemplo.com
 *   # or
 *   TARGET=<uid> npx ts-node src/scripts/verify-user-email.ts
 */

import { getAuth } from "firebase-admin/auth";
import { initScriptAdmin } from "./_script-init";

async function main(): Promise<void> {
  const projectId = initScriptAdmin();
  const target = String(process.env.TARGET || process.argv[2] || "").trim();
  if (!target) {
    throw new Error("Informe o alvo: npx ts-node ... <email-ou-uid> (ou TARGET=...)");
  }

  const auth = getAuth();
  const user = target.includes("@")
    ? await auth.getUserByEmail(target)
    : await auth.getUser(target);

  if (user.emailVerified) {
    console.log(`Já estava verificado: ${user.uid} (${user.email})`);
    return;
  }

  await auth.updateUser(user.uid, { emailVerified: true });
  console.log(
    `✅ emailVerified=true definido para ${user.uid} (${user.email}) em ${projectId}`,
  );
}

main().catch((err: Error) => {
  console.error(`\n❌ Erro fatal:`, err.message);
  process.exit(1);
});
