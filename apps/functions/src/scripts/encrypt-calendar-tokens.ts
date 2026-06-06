/**
 * One-time migration: encrypt plaintext Google Calendar refresh tokens.
 *
 * Iterates `calendar_integrations`, and for every document that still holds a
 * plaintext `refreshToken` without a `refreshTokenEnc`, encrypts the token via
 * Cloud KMS, writes `refreshTokenEnc`, and clears the plaintext field.
 *
 * Idempotent: documents already carrying `refreshTokenEnc` are skipped, so the
 * script is safe to run repeatedly.
 *
 * Credentials are auto-loaded from apps/functions/.env.<projectId>. The KMS key
 * env (CALENDAR_TOKEN_KMS_KEY or KEYRING + KEY_ID, optional LOCATION) must be
 * set, and the credentials must have cryptoKeyEncrypterDecrypter on the key.
 *
 * Usage:
 *   ts-node src/scripts/encrypt-calendar-tokens.ts [--dry-run]
 */

import { getFirestore } from "firebase-admin/firestore";
import { initScriptAdmin } from "./_script-init";
import { encryptToken, isEncryptedToken } from "../lib/token-encryption";

const COLLECTION = "calendar_integrations";

async function main(): Promise<void> {
  const projectId = initScriptAdmin();
  const dryRun = process.argv.includes("--dry-run");
  const db = getFirestore();

  console.log(
    `[encrypt-calendar-tokens] project=${projectId} dryRun=${dryRun}`,
  );

  const snapshot = await db.collection(COLLECTION).get();

  let scanned = 0;
  let migrated = 0;
  let alreadyEncrypted = 0;
  let empty = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data() as {
      refreshToken?: string | null;
      refreshTokenEnc?: string | null;
    };

    const existingEnc = String(data.refreshTokenEnc || "").trim();
    if (existingEnc) {
      alreadyEncrypted += 1;
      continue;
    }

    const plaintext = String(data.refreshToken || "").trim();
    if (!plaintext) {
      empty += 1;
      continue;
    }

    if (isEncryptedToken(plaintext)) {
      // Defensive: a ciphertext sitting in the legacy field — relocate without
      // re-encrypting.
      if (!dryRun) {
        await doc.ref.update({ refreshToken: "", refreshTokenEnc: plaintext });
      }
      migrated += 1;
      continue;
    }

    try {
      const ciphertext = await encryptToken(plaintext);
      if (!dryRun) {
        await doc.ref.update({
          refreshToken: "",
          refreshTokenEnc: ciphertext,
        });
      }
      migrated += 1;
      console.log(`  migrated ${doc.id}`);
    } catch (error) {
      errors += 1;
      console.error(
        `  ERROR ${doc.id}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  console.log(
    `[encrypt-calendar-tokens] done scanned=${scanned} migrated=${migrated} ` +
      `alreadyEncrypted=${alreadyEncrypted} empty=${empty} errors=${errors}`,
  );

  if (errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((err: Error) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
