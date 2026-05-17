import { getStripe } from "../stripe/stripeConfig";
import { writeSecurityAuditEvent } from "../lib/security-observability";
import { logger } from "../lib/logger";
import { classifySubscription } from "./subscription-classifier";
import type { DuplicateCancelResult } from "./billing-types";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;
type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

function isActiveStatus(status: string): status is ActiveStatus {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

type SubShape = {
  id: string;
  status: string;
  created: number;
  metadata?: Record<string, string> | null;
  items: { data: Array<{ price: { id: string } }> };
};

export async function findAndCancelDuplicateSubscriptions(
  customerId: string,
  opts: {
    keep: "oldest" | "newest";
    prorate: boolean;
    dryRun?: boolean;
    tenantId?: string;
  },
): Promise<DuplicateCancelResult> {
  if (!customerId || !customerId.trim()) {
    return { kept: "", canceled: [] };
  }

  const stripe = getStripe();
  const list = await stripe.subscriptions.list({
    customer: customerId,
    limit: 20,
  });

  const eligible = (list.data as unknown as SubShape[]).filter(
    (sub) => classifySubscription(sub) === "main" && isActiveStatus(sub.status),
  );

  if (eligible.length <= 1) {
    return { kept: eligible[0]?.id ?? "", canceled: [] };
  }

  const sorted = [...eligible].sort((a, b) => a.created - b.created);

  // Race-window guard: if the newest main-plan subscription was created within
  // the last 90 seconds, it is likely from an active checkout session that
  // has not yet been confirmed via checkout.session.completed. Skip cleanup
  // to prevent canceling a subscription the user just paid for.
  const RACE_WINDOW_SECONDS = 90;
  const nowSec = Math.floor(Date.now() / 1000);
  const newest = sorted[sorted.length - 1];
  if (newest && nowSec - newest.created < RACE_WINDOW_SECONDS) {
    logger.info("findAndCancelDuplicateSubscriptions: race window active, skipping cleanup", {
      customerId,
      newestSubId: newest.id,
      ageSeconds: nowSec - newest.created,
    });
    return { kept: sorted[0].id, canceled: [] };
  }

  const kept = opts.keep === "oldest" ? sorted[0] : sorted[sorted.length - 1];
  const toCancel = sorted.filter((sub) => sub.id !== kept.id);

  const canceled: string[] = [];

  if (!opts.dryRun) {
    for (const sub of toCancel) {
      try {
        await stripe.subscriptions.cancel(sub.id, {
          prorate: opts.prorate,
          invoice_now: false,
        });
        canceled.push(sub.id);
      } catch (err) {
        logger.error("Failed to cancel duplicate subscription", {
          subscriptionId: sub.id,
          customerId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } else {
    canceled.push(...toCancel.map((s) => s.id));
  }

  if (canceled.length > 0) {
    await writeSecurityAuditEvent({
      eventType: "STRIPE_DUPLICATE_CANCELED",
      source: "billing_module",
      tenantId: opts.tenantId ?? customerId,
      reason: `Canceled ${canceled.length} duplicate(s), kept ${kept.id}`,
      status: 200,
    });
  }

  return { kept: kept.id, canceled };
}
