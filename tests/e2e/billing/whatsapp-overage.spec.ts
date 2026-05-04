/**
 * BILL-05: WhatsApp overage cron E2E tests.
 *
 * Verifies that the monthly WhatsApp overage cron:
 * 1. Processes tenants with overageMessages > 0 and reports errors when
 *    stripeCustomerId is missing (expected in emulator — no real Stripe).
 * 2. Skips tenants where stripeReported=true (idempotency guarantee).
 *
 * Architecture notes:
 * - Pure HTTP tests — no browser page, no authenticatedPage (per D-08).
 * - Uses fetch() directly against the Functions emulator.
 * - Admin SDK writes directly to the Firestore emulator (no auth boundary).
 * - Collection name: whatsappUsage (camelCase — NOT whatsapp_usage, per Research Finding 4).
 * - The /internal/cron/* route is registered after validateFirebaseIdToken in api/index.ts,
 *   so requests require BOTH a valid Firebase ID token AND the x-cron-secret header.
 * - Stripe call fails in emulator (no stripeCustomerId set) — stripeReported stays false.
 */

import { test, expect } from "@playwright/test";
import { getTestDb } from "../helpers/admin-firestore";
import { signInWithEmailPassword } from "../helpers/firebase-auth-api";
import { USER_ADMIN_BETA } from "../seed/data/users";
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const FUNCTIONS_BASE =
  "http://127.0.0.1:5001/demo-proops-test/southamerica-east1/api";

/**
 * Resolve the CRON_SECRET that the Functions emulator loaded.
 *
 * Firebase emulator env loading order (later files override earlier ones):
 *   1. functions/.env
 *   2. functions/.env.{projectId}  (e.g. .env.demo-proops-test)
 *   3. functions/.env.local  (highest priority — always loaded for emulator)
 *
 * The test reads the same files in the same order so the resolved CRON_SECRET
 * matches what the emulator has. process.env.CRON_SECRET is intentionally NOT
 * consulted here: global-setup may set it to a value that the emulator env files
 * then override, causing a mismatch between what the test sends and what the
 * emulator expects.
 */
function resolveCronSecret(): string {
  // Replicate emulator env loading order (last file wins)
  const envFiles = [
    "apps/functions/.env",
    "apps/functions/.env.demo-proops-test",
    "apps/functions/.env.local",
  ];

  let resolved = "test-cron-secret";
  for (const relPath of envFiles) {
    try {
      const content = fs.readFileSync(
        path.join(process.cwd(), relPath),
        "utf-8",
      );
      const match = content.match(/^CRON_SECRET=(.+)$/m);
      if (match) resolved = match[1].trim();
    } catch {
      // File not found or unreadable — skip
    }
  }
  return resolved;
}

const CRON_SECRET = resolveCronSecret();

/** Past month — not the current month, to avoid interference with active usage. */
const TEST_MONTH = "2025-01";

test.describe("BILL-05: WhatsApp overage cron", () => {
  const db = getTestDb();
  let idToken: string;

  test.beforeAll(async () => {
    // Authenticate as admin-beta. The /internal route requires a valid Firebase ID
    // token (validateFirebaseIdToken runs before it) AND the x-cron-secret header.
    const signIn = await signInWithEmailPassword(
      USER_ADMIN_BETA.email,
      USER_ADMIN_BETA.password,
    );
    idToken = signIn.idToken;

    // Seed tenant-beta with WhatsApp overage fields enabled.
    // Intentionally do NOT set stripeCustomerId — the controller will push to
    // errors[] with "Missing tenant.stripeCustomerId", bypassing the real Stripe call.
    await db.collection("tenants").doc("tenant-beta").set(
      {
        whatsappEnabled: true,
        whatsappAllowOverage: true,
      },
      { merge: true },
    );
  });

  test.afterAll(async () => {
    // Remove WhatsApp overage fields from the tenant doc.
    await db.collection("tenants").doc("tenant-beta").update({
      whatsappEnabled: admin.firestore.FieldValue.delete(),
      whatsappAllowOverage: admin.firestore.FieldValue.delete(),
    });

    // Delete the test whatsappUsage month document.
    await db
      .collection("whatsappUsage")
      .doc("tenant-beta")
      .collection("months")
      .doc(TEST_MONTH)
      .delete();
  });

  test("cron processes tenant with overageMessages and reports result", async () => {
    // Seed overage usage for the test month.
    await db
      .collection("whatsappUsage")
      .doc("tenant-beta")
      .collection("months")
      .doc(TEST_MONTH)
      .set({
        overageMessages: 50,
        stripeReported: false,
      });

    const response = await fetch(
      `${FUNCTIONS_BASE}/internal/cron/whatsapp-overage-report`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "x-cron-secret": CRON_SECRET,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month: TEST_MONTH }),
      },
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      month: string;
      processed: number;
      charged: number;
      skipped: number;
      errors: Array<{ tenantId: string; message: string }>;
    };

    // Cron ran and returned structured results.
    expect(typeof body.processed).toBe("number");
    expect(body.processed).toBeGreaterThanOrEqual(0);

    // Stripe call failed (no stripeCustomerId) — stripeReported stays false.
    const usageSnap = await db
      .collection("whatsappUsage")
      .doc("tenant-beta")
      .collection("months")
      .doc(TEST_MONTH)
      .get();

    expect(usageSnap.data()?.stripeReported).toBe(false);

    // errors[] contains an entry for tenant-beta with the expected message.
    expect(Array.isArray(body.errors)).toBe(true);
    expect(body.errors.length).toBeGreaterThan(0);

    const betaError = body.errors.find((e) => e.tenantId === "tenant-beta");
    expect(betaError).toBeDefined();
    expect(betaError?.message).toContain("stripeCustomerId");
  });

  test("cron skips tenant with stripeReported=true (idempotency)", async () => {
    // Seed usage doc with stripeReported=true (already reported).
    await db
      .collection("whatsappUsage")
      .doc("tenant-beta")
      .collection("months")
      .doc(TEST_MONTH)
      .set({
        overageMessages: 50,
        stripeReported: true,
      });

    const response = await fetch(
      `${FUNCTIONS_BASE}/internal/cron/whatsapp-overage-report`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "x-cron-secret": CRON_SECRET,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month: TEST_MONTH }),
      },
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      month: string;
      processed: number;
      charged: number;
      skipped: number;
      errors: Array<{ tenantId: string; message: string }>;
    };

    // The already-reported tenant was skipped.
    expect(body.skipped).toBeGreaterThanOrEqual(1);
  });
});
