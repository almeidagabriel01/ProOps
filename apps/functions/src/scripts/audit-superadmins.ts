/**
 * Audit script: lists every account with super admin power and flags the ones
 * that are NOT in SUPERADMIN_ALLOWLIST and/or have NOT enrolled MFA. Run this
 * BEFORE flipping SUPERADMIN_MFA_REQUIRED=true or deploying the MFA-gated
 * firestore rules — it tells you exactly who would be locked out.
 *
 * Super admin power comes from two sources (both honoured by the rules and the
 * backend auth context):
 *   - the `role` custom claim on the Firebase Auth user, and
 *   - the `role` field on the users/{uid} Firestore document (stale-claims path)
 *
 * Read-only — never mutates anything.
 *
 * Pre-requisites:
 *   1. Firebase credentials (GOOGLE_APPLICATION_CREDENTIALS or
 *      `gcloud auth application-default login`).
 *   2. SUPERADMIN_ALLOWLIST set (comma-separated emails/uids) to evaluate the
 *      allowlist column; if unset, every super admin is reported as NOT in an
 *      allowlist (enforcement off).
 *
 * Usage:
 *   cd apps/functions
 *   npx dotenv -e .env.erp-softcode -- npx ts-node src/scripts/audit-superadmins.ts
 */

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type SuperAdmin = {
  uid: string;
  email: string;
  viaClaim: boolean;
  viaDoc: boolean;
  mfaEnrolled: boolean;
};

const SUPERADMIN_ROLES = new Set(["superadmin"]);

function parseAllowlist(): string[] {
  return String(process.env.SUPERADMIN_ALLOWLIST || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isAllowlisted(allowlist: string[], email: string, uid: string): boolean {
  const emailLc = email.trim().toLowerCase();
  return allowlist.some(
    (entry) => entry === uid || entry.toLowerCase() === emailLc,
  );
}

async function main(): Promise<void> {
  const projectId = String(process.env.GCLOUD_PROJECT || "erp-softcode").trim();
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault(), projectId });
  }

  const auth = getAuth();
  const db = getFirestore();
  const allowlist = parseAllowlist();

  const found = new Map<string, SuperAdmin>();

  // 1. Auth users with a SUPERADMIN role custom claim.
  let pageToken: string | undefined = undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      const role = String(user.customClaims?.role || "").trim().toLowerCase();
      if (!SUPERADMIN_ROLES.has(role)) continue;
      found.set(user.uid, {
        uid: user.uid,
        email: String(user.email || ""),
        viaClaim: true,
        viaDoc: false,
        mfaEnrolled: (user.multiFactor?.enrolledFactors?.length || 0) > 0,
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  // 2. users/{uid} docs whose role grants super admin via the stale-claims path.
  const docSnap = await db
    .collection("users")
    .where("role", "in", ["SUPERADMIN", "superadmin"])
    .get();
  for (const docRef of docSnap.docs) {
    const uid = docRef.id;
    const email = String(docRef.data()?.email || "");
    const existing = found.get(uid);
    if (existing) {
      existing.viaDoc = true;
      if (!existing.email) existing.email = email;
    } else {
      let mfaEnrolled = false;
      try {
        const user = await auth.getUser(uid);
        mfaEnrolled = (user.multiFactor?.enrolledFactors?.length || 0) > 0;
      } catch {
        // user may exist only in Firestore; leave mfaEnrolled = false
      }
      found.set(uid, {
        uid,
        email,
        viaClaim: false,
        viaDoc: true,
        mfaEnrolled,
      });
    }
  }

  const admins = [...found.values()];

  console.log(`\n=== Super Admin Audit — ${projectId} ===`);
  console.log(
    `Allowlist (${allowlist.length} entries): ${
      allowlist.length ? allowlist.join(", ") : "(unset — enforcement OFF)"
    }\n`,
  );

  if (admins.length === 0) {
    console.log("No super admins found.");
    return;
  }

  let notAllowlisted = 0;
  let withoutMfa = 0;
  for (const a of admins) {
    const allowOk = allowlist.length > 0 && isAllowlisted(allowlist, a.email, a.uid);
    if (!allowOk) notAllowlisted += 1;
    if (!a.mfaEnrolled) withoutMfa += 1;
    const source = [a.viaClaim ? "claim" : null, a.viaDoc ? "doc" : null]
      .filter(Boolean)
      .join("+");
    console.log(
      `${allowOk ? "✓" : "✗"} allowlist | ${
        a.mfaEnrolled ? "✓" : "✗"
      } mfa | ${a.uid} | ${a.email || "(no email)"} | via ${source}`,
    );
  }

  console.log(
    `\nTotal: ${admins.length} | not allowlisted: ${notAllowlisted} | without MFA: ${withoutMfa}`,
  );
  if (withoutMfa > 0) {
    console.log(
      `\n⚠ ${withoutMfa} super admin(s) without MFA will lose access once` +
        ` enforcement is enabled. Enroll them via /admin/setup-mfa first.`,
    );
  }
}

main().catch((err: Error) => {
  console.error(`\n❌ Erro fatal:`, err.message);
  process.exit(1);
});
