/**
 * One-shot fixer: tenants connected to MercadoPago before commit 2a7a5b03
 * may have mercadoPago.environment="production" even though their seller
 * account is a @testuser.com test account. This causes sandbox card payments
 * to fail because the sandbox access token override is never applied.
 *
 * Detection: GET /users/me with the tenant's accessToken — if email ends in
 * @testuser.com but environment !== "sandbox", patch the tenant document.
 *
 * Run manually:
 *   cd apps/functions
 *   npx tsx src/scripts/fix-mp-environment-mismatch.ts [--dry-run]
 *
 * --dry-run: lists affected tenants without writing to Firestore.
 *
 * Safe to re-run: no-op for tenants already correct.
 */
import axios from "axios";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../init";

const DRY_RUN = process.argv.includes("--dry-run");

export interface TenantMpSnapshot {
  email: string;
  environment: string | undefined;
  liveMode: boolean | undefined;
}

export interface FixDecision {
  shouldFix: boolean;
  reason: string;
}

/** Pure function — determines whether a tenant's MP doc needs patching. */
export function evaluateTenantFix(snap: TenantMpSnapshot): FixDecision {
  if (!snap.email.endsWith("@testuser.com")) {
    return { shouldFix: false, reason: "not a test seller account" };
  }
  if (snap.environment === "sandbox" && snap.liveMode === false) {
    return { shouldFix: false, reason: "already correctly set to sandbox" };
  }
  return {
    shouldFix: true,
    reason: `environment=${snap.environment ?? "undefined"} liveMode=${snap.liveMode ?? "undefined"} but email is @testuser.com`,
  };
}

async function fetchSellerEmail(accessToken: string): Promise<string | null> {
  try {
    const resp = await axios.get<{ email?: string }>(
      "https://api.mercadopago.com/users/me",
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10_000 },
    );
    return resp.data?.email ?? null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log(`=== fix-mp-environment-mismatch ${DRY_RUN ? "(DRY RUN)" : ""}: starting ===`);

  const tenantsSnap = await db
    .collection("tenants")
    .where("mercadoPagoEnabled", "==", true)
    .get();

  console.log(`Found ${tenantsSnap.size} tenants with mercadoPagoEnabled=true`);

  let checked = 0;
  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of tenantsSnap.docs) {
    const tenantId = doc.id;
    const data = doc.data() as Record<string, unknown>;
    const mp = data.mercadoPago as Record<string, unknown> | undefined;

    if (!mp?.accessToken || typeof mp.accessToken !== "string") {
      console.log(`[${tenantId}] no accessToken — skipping`);
      skipped++;
      continue;
    }

    checked++;
    const email = await fetchSellerEmail(mp.accessToken as string);
    if (!email) {
      console.warn(`[${tenantId}] could not fetch /users/me — skipping`);
      skipped++;
      continue;
    }

    const snap: TenantMpSnapshot = {
      email,
      environment: typeof mp.environment === "string" ? mp.environment : undefined,
      liveMode: typeof mp.liveMode === "boolean" ? mp.liveMode : undefined,
    };

    const decision = evaluateTenantFix(snap);

    if (!decision.shouldFix) {
      console.log(`[${tenantId}] OK — ${decision.reason}`);
      skipped++;
      continue;
    }

    console.log(
      `[${tenantId}] NEEDS FIX — ${decision.reason} (email: ${email.replace(/(?<=.{4}).+(?=@)/, "***")})`,
    );

    if (!DRY_RUN) {
      try {
        await doc.ref.update({
          "mercadoPago.environment": "sandbox",
          "mercadoPago.liveMode": false,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[${tenantId}] FIXED`);
        fixed++;
      } catch (err) {
        console.error(`[${tenantId}] ERROR:`, err instanceof Error ? err.message : err);
        errors++;
      }
    } else {
      fixed++;
    }
  }

  console.log(
    `=== done: checked=${checked} ${DRY_RUN ? "would-fix" : "fixed"}=${fixed} skipped=${skipped} errors=${errors} ===`,
  );

  if (DRY_RUN && fixed > 0) {
    console.log("Re-run without --dry-run to apply changes.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
