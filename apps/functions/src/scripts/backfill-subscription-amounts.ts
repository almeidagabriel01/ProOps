/**
 * One-shot backfill: fetches unit_amount and currency from the Stripe Price
 * object for every user with an active Stripe subscription and writes the
 * values to both users/{uid} and tenants/{tenantId} (top-level and nested
 * under subscription.*).
 *
 * Run manually:
 *   cd apps/functions
 *   npx tsx src/scripts/backfill-subscription-amounts.ts
 *
 * Idempotent — safe to re-run. Skips tenants with isManualSubscription: true.
 */
import { db } from "../init";
import { getStripe } from "../stripe/stripeConfig";

const WHATSAPP_OVERAGE_PRICE_ID = "price_1T20T7GrkF9UfsqcEtdBX9fY";

function extractPrimaryPriceIdFromItems(
  items: Array<{ price?: { id?: string } }>,
): string | undefined {
  // First non-overage item, then first item as fallback
  const nonOverage = items.find(
    (item) => item.price?.id && item.price.id !== WHATSAPP_OVERAGE_PRICE_ID,
  );
  const priceId = String(nonOverage?.price?.id || items[0]?.price?.id || "").trim();
  return priceId || undefined;
}

async function main(): Promise<void> {
  console.log("=== backfill-subscription-amounts: starting ===");

  const stripe = getStripe();

  const usersSnap = await db
    .collection("users")
    .where("stripeSubscriptionId", "!=", null)
    .get();

  console.log(`Found ${usersSnap.size} users with a Stripe subscription`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  for (const userDoc of usersSnap.docs) {
    processed++;
    if (processed % 10 === 0) {
      console.log(`Progress: ${processed}/${usersSnap.size} (updated=${updated}, skipped=${skipped}, errors=${errors})`);
    }

    const userData = userDoc.data() as Record<string, unknown>;
    const tenantId = String(userData.tenantId || userData.companyId || "").trim();

    if (!tenantId) {
      console.warn(`User ${userDoc.id}: no tenantId — skipping`);
      skipped++;
      continue;
    }

    // Skip manual subscriptions — no Stripe price to fetch
    if (userData.isManualSubscription === true) {
      skipped++;
      continue;
    }

    const stripeSubscriptionId = String(userData.stripeSubscriptionId || "").trim();
    if (!stripeSubscriptionId) {
      skipped++;
      continue;
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ["items.data.price"],
      });

      const items = (subscription.items?.data ?? []) as Array<{
        price?: { id?: string };
      }>;
      const priceId = extractPrimaryPriceIdFromItems(items);

      if (!priceId) {
        console.warn(`User ${userDoc.id} / tenant ${tenantId}: no price found on subscription ${stripeSubscriptionId} — skipping`);
        skipped++;
        continue;
      }

      const price = await stripe.prices.retrieve(priceId);
      const unitAmount: number | null = price.unit_amount ?? null;
      const currency: string | null = price.currency ?? null;

      const nowIso = new Date().toISOString();

      // Build the patch — mirrors the shape syncTenantPlanBillingSnapshot writes
      const userPatch: Record<string, unknown> = {
        unitAmount,
        currency,
        updatedAt: nowIso,
      };

      const tenantRef = db.collection("tenants").doc(tenantId);
      const tenantSnap = await tenantRef.get();

      if (!tenantSnap.exists) {
        console.warn(`Tenant ${tenantId} (user ${userDoc.id}): doc not found — skipping tenant write`);
        await db.collection("users").doc(userDoc.id).set(userPatch, { merge: true });
        updated++;
        continue;
      }

      const tenantData = tenantSnap.data() as Record<string, unknown>;
      const existingSubscription =
        (tenantData.subscription as Record<string, unknown> | undefined) ?? {};

      const tenantPatch: Record<string, unknown> = {
        unitAmount,
        currency,
        updatedAt: nowIso,
        subscription: {
          ...existingSubscription,
          unitAmount,
          currency,
        },
      };

      console.log(
        `Tenant ${tenantId} (user ${userDoc.id}): unitAmount=${unitAmount} currency=${currency} priceId=${priceId}`,
      );

      await Promise.all([
        db.collection("users").doc(userDoc.id).set(userPatch, { merge: true }),
        tenantRef.set(tenantPatch, { merge: true }),
      ]);

      updated++;
    } catch (err) {
      console.error(
        `Error processing user ${userDoc.id} / tenant ${tenantId}:`,
        err instanceof Error ? err.message : String(err),
      );
      errors++;
    }
  }

  console.log("=== backfill-subscription-amounts: done ===");
  console.log(`  updated: ${updated}, skipped: ${skipped}, errors: ${errors}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
