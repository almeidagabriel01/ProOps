import { db } from "../init";
import { getStripe } from "../stripe/stripeConfig";
import {
  WHATSAPP_OVERAGE_PRICE_ID,
  updateSubscriptionStatus,
  upsertTenantStripeBillingData,
  mapStripeSubscriptionStatus,
} from "../stripe/stripeHelpers";
import { syncTenantPlanBillingSnapshot } from "../stripe/stripeWebhook";
import { logger } from "../lib/logger";
import {
  mapStripeStatusToBilling,
  resolvePlanFromPrice,
  extractBillingInterval,
  extractPrimaryPriceId,
  extractTrialEndsAt,
  isMainPlanSubscription,
} from "./billing-mappers";
import { findAndCancelDuplicateSubscriptions } from "./duplicate-handler";
import type { BillingSnapshot } from "./billing-types";

type StripeSubLike = {
  id: string;
  status: string;
  created: number;
  cancel_at_period_end: boolean;
  trial_end?: number | null;
  metadata?: Record<string, string> | null;
  items: { data: Array<{ price: { id: string; recurring?: { interval?: string } | null } }> };
  current_period_end?: number;
};

export async function syncTenantBillingFromStripe(
  tenantId: string,
  opts: { source: BillingSnapshot["source"]; force?: boolean } = {
    source: "on_demand",
  },
): Promise<BillingSnapshot> {
  const tid = String(tenantId || "").trim();
  if (!tid) throw new Error("TENANT_ID_REQUIRED");

  const tenantRef = db.collection("tenants").doc(tid);

  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) throw new Error("TENANT_NOT_FOUND");
  const tenantData = tenantSnap.data() as Record<string, unknown>;

  const stripeCustomerId = String(tenantData.stripeCustomerId || "").trim() || null;
  const existingSubscriptionStatus = String(tenantData.subscriptionStatus || "").toLowerCase();
  const existingPastDueSince =
    typeof tenantData.pastDueSince === "string" ? tenantData.pastDueSince : null;

  if (!stripeCustomerId && existingSubscriptionStatus !== "past_due") {
    const freeSnapshot: BillingSnapshot = {
      tenantId: tid,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      plan: "free",
      billingInterval: "monthly",
      subscriptionStatus: "inactive",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      pastDueSince: null,
      trialEndsAt: null,
      billingSyncedAt: new Date().toISOString(),
      billingSyncing: false,
      source: opts.source,
    };
    await tenantRef.set({ billingSyncedAt: freeSnapshot.billingSyncedAt }, { merge: true });
    return freeSnapshot;
  }

  await tenantRef.set({ billingSyncing: true }, { merge: true });

  try {
    const stripe = getStripe();
    const listResult = await stripe.subscriptions.list({
      customer: stripeCustomerId!,
      limit: 20,
      expand: ["data.items.data.price"],
    });

    const allSubs = listResult.data as unknown as StripeSubLike[];

    const mainSubs = allSubs.filter((sub) => isMainPlanSubscription(sub));

    const activeSubs = mainSubs.filter((sub) =>
      ["active", "trialing", "past_due", "unpaid"].includes(sub.status),
    );

    let canonical: StripeSubLike | null = null;

    if (activeSubs.length > 1) {
      const dedup = await findAndCancelDuplicateSubscriptions(stripeCustomerId!, {
        keep: "oldest",
        prorate: true,
        dryRun: false,
        tenantId: tid,
      });
      const fetched = await stripe.subscriptions.retrieve(dedup.kept, {
        expand: ["items.data.price"],
      });
      canonical = fetched as unknown as StripeSubLike;
    } else if (activeSubs.length === 1) {
      canonical = activeSubs[0];
    } else {
      const canceledSubs = mainSubs
        .filter((sub) => sub.status === "canceled")
        .sort((a, b) => b.created - a.created);
      canonical = canceledSubs[0] ?? null;
    }

    if (!canonical) {
      const emptySnapshot: BillingSnapshot = {
        tenantId: tid,
        stripeCustomerId,
        stripeSubscriptionId:
          String(tenantData.stripeSubscriptionId || "").trim() || null,
        stripePriceId: null,
        plan: "free",
        billingInterval: "monthly",
        subscriptionStatus: "canceled",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        pastDueSince: null,
        trialEndsAt: null,
        billingSyncedAt: new Date().toISOString(),
        billingSyncing: false,
        source: opts.source,
      };
      await tenantRef.set(
        { billingSyncing: false, billingSyncedAt: emptySnapshot.billingSyncedAt },
        { merge: true },
      );
      return emptySnapshot;
    }

    const billingStatus = mapStripeStatusToBilling(canonical.status);
    const stripePriceId = extractPrimaryPriceId(canonical);
    const plan = resolvePlanFromPrice(stripePriceId) ?? "free";
    const billingInterval = extractBillingInterval(canonical);

    const rawPeriodEnd = canonical.current_period_end;
    const currentPeriodEnd = rawPeriodEnd
      ? new Date(rawPeriodEnd * 1000).toISOString()
      : null;
    const currentPeriodEndDate = rawPeriodEnd ? new Date(rawPeriodEnd * 1000) : undefined;

    const cancelAtPeriodEnd = canonical.cancel_at_period_end ?? false;
    const trialEndsAt = extractTrialEndsAt(canonical);

    const pastDueSince =
      billingStatus === "past_due"
        ? (existingPastDueSince ?? new Date().toISOString())
        : null;

    const usersQuery = await db
      .collection("users")
      .where("tenantId", "==", tid)
      .where("role", "in", ["MASTER", "ADMIN", "master", "admin"])
      .limit(1)
      .get();

    const adminUid = usersQuery.empty ? null : usersQuery.docs[0].id;

    await syncTenantPlanBillingSnapshot({
      tenantId: tid,
      subscriptionStatus: billingStatus,
      stripePriceId: stripePriceId ?? undefined,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripeSubscriptionId: canonical.id,
      currentPeriodEnd: currentPeriodEndDate,
      cancelAtPeriodEnd,
      pastDueSince: pastDueSince ?? null,
      trialEndsAt: trialEndsAt ?? null,
      plan: plan as import("../lib/tenant-plan-policy").TenantPlanTier,
      billingInterval,
      source: "cron.checkStripeSubscriptions",
    });

    const whatsappItem = canonical.items.data.find(
      (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
    ) as (StripeSubLike["items"]["data"][number] & { id?: string }) | undefined;

    await upsertTenantStripeBillingData({
      tenantId: tid,
      stripeCustomerId: stripeCustomerId ?? undefined,
      stripeSubscriptionId: canonical.id,
      ...(whatsappItem && {
        whatsappOveragePriceId: WHATSAPP_OVERAGE_PRICE_ID,
        whatsappOverageSubscriptionItemId: whatsappItem.id,
      }),
    });

    if (adminUid) {
      await updateSubscriptionStatus(
        adminUid,
        mapStripeSubscriptionStatus(canonical.status),
        "billing_sync",
        currentPeriodEndDate,
        cancelAtPeriodEnd,
      );
    }

    const now = new Date().toISOString();
    const snapshot: BillingSnapshot = {
      tenantId: tid,
      stripeCustomerId,
      stripeSubscriptionId: canonical.id,
      stripePriceId,
      plan,
      billingInterval,
      subscriptionStatus: billingStatus,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      pastDueSince,
      trialEndsAt,
      billingSyncedAt: now,
      billingSyncing: false,
      source: opts.source,
    };

    return snapshot;
  } catch (err) {
    logger.error("syncTenantBillingFromStripe failed", {
      tenantId: tid,
      source: opts.source,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    await tenantRef.set({ billingSyncing: false }, { merge: true }).catch(() => {
      // best-effort cleanup
    });
  }
}
