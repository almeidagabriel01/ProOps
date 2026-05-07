// One-time cleanup script. Run with --apply to execute changes. Default is dry-run.
import "dotenv/config";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import * as fs from "fs";
import * as path from "path";

initializeApp();
const db = getFirestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia" as any,
});

const WHATSAPP_OVERAGE_PRICE_ID = "price_1T20T7GrkF9UfsqcEtdBX9fY";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isMainPlanSubscription(sub: Stripe.Subscription): boolean {
  if (sub.metadata?.type === "addon") return false;
  const items = sub.items.data;
  if (items.length === 0) return false;
  const allWhatsapp = items.every(
    (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
  );
  return !allWhatsapp;
}

interface ReportCandidate {
  tenantId: string;
  customerId: string;
  kept: string;
  canceled: string[];
}

interface Report {
  generatedAt: string;
  dryRun: boolean;
  tenantsScanned: number;
  duplicatesFound: number;
  subscriptionsCanceled: number;
  errors: string[];
  candidates: ReportCandidate[];
}

async function main(): Promise<void> {
  const isDryRun = !process.argv.includes("--apply");

  if (isDryRun) {
    console.log("[DRY-RUN] No changes will be made.");
  } else {
    console.log("[APPLY] Changes WILL be applied.");
  }

  const report: Report = {
    generatedAt: new Date().toISOString(),
    dryRun: isDryRun,
    tenantsScanned: 0,
    duplicatesFound: 0,
    subscriptionsCanceled: 0,
    errors: [],
    candidates: [],
  };

  const tenantsSnap = await db.collection("tenants").orderBy("createdAt").get();
  report.tenantsScanned = tenantsSnap.size;

  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId = tenantDoc.id;
    const data = tenantDoc.data() as Record<string, unknown>;
    const stripeCustomerId = String(data?.stripeCustomerId || "").trim();

    if (!stripeCustomerId) continue;

    await sleep(100);

    let allSubs: Stripe.Subscription[];
    try {
      const listResult = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 20,
      });
      allSubs = listResult.data;
    } catch (err) {
      const msg = `tenantId=${tenantId} customer=${stripeCustomerId}: failed to list subscriptions: ${err instanceof Error ? err.message : String(err)}`;
      console.error(msg);
      report.errors.push(msg);
      continue;
    }

    const mainPlanSubs = allSubs.filter(isMainPlanSubscription);
    const activeDuplicates = mainPlanSubs.filter((s) =>
      ["active", "trialing", "past_due"].includes(s.status),
    );

    if (activeDuplicates.length <= 1) continue;

    activeDuplicates.sort((a, b) => a.created - b.created);
    const kept = activeDuplicates[0];
    const toCancel = activeDuplicates.slice(1);

    report.duplicatesFound += 1;
    console.log(
      `DUPLICATE FOUND tenantId=${tenantId} customer=${stripeCustomerId} kept=${kept.id} toCancel=${toCancel.map((s) => s.id).join(",")}`,
    );

    const candidate: ReportCandidate = {
      tenantId,
      customerId: stripeCustomerId,
      kept: kept.id,
      canceled: [],
    };

    if (!isDryRun) {
      for (const sub of toCancel) {
        try {
          await stripe.subscriptions.cancel(sub.id, { prorate: true });
          console.log(`  Canceled subscription ${sub.id} for tenant ${tenantId}`);
          candidate.canceled.push(sub.id);
          report.subscriptionsCanceled += 1;
        } catch (err) {
          const msg = `tenantId=${tenantId} sub=${sub.id}: cancel failed: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`  ERROR: ${msg}`);
          report.errors.push(msg);
        }
      }

      try {
        await db.collection("tenants").doc(tenantId).set(
          {
            stripeSubscriptionId: kept.id,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        console.log(`  Updated tenantDoc stripeSubscriptionId → ${kept.id}`);
      } catch (err) {
        const msg = `tenantId=${tenantId}: failed to update tenant doc: ${err instanceof Error ? err.message : String(err)}`;
        console.error(`  ERROR: ${msg}`);
        report.errors.push(msg);
      }
    }

    report.candidates.push(candidate);
  }

  const filename = `cleanup-duplicates-${Date.now()}.json`;
  const filepath = path.join(process.cwd(), filename);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  console.log(`\nReport saved to: ${filepath}`);
  console.log(
    JSON.stringify(
      {
        dryRun: report.dryRun,
        tenantsScanned: report.tenantsScanned,
        duplicatesFound: report.duplicatesFound,
        subscriptionsCanceled: report.subscriptionsCanceled,
        errorsCount: report.errors.length,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
