// Phase 19 — canonical billing types (per D-CONTEXT.md subscription.* schema lock).
// Single source of truth consumed by Plan 02's extended syncTenantPlanBillingSnapshot
// and by Plan 03's parallel-writer consolidation.

import type { Timestamp } from "firebase-admin/firestore";
import type { TenantPlanTier } from "../lib/tenant-plan-policy";

/**
 * Canonical nested map written under tenants/{tenantId}.subscription
 * by syncTenantPlanBillingSnapshot inside its db.runTransaction().
 *
 * IMPORTANT: All top-level billing fields on the tenant document are
 * KEPT IN PARALLEL during Phase 19 (reader audit confirmed all major
 * fields have active readers; subscriptionStatus and currentPeriodEnd
 * are Firestore query filters in checkManualSubscriptions.ts).
 * NEVER drop a top-level field in this phase.
 */
export interface SubscriptionSnapshot {
  // Core status
  status?: string; // "active" | "past_due" | "canceled" | "trialing" | "inactive" | etc. (lowercase)
  pastDueSince?: string | null; // ISO timestamp string; null clears it
  cancelAtPeriodEnd?: boolean;
  cancelAt?: string | null; // ISO; absolute cancel date for Phase 20 banner

  // Stripe identifiers
  stripeSubscriptionId?: string | null; // null clears the field (subscription deleted)
  stripePriceId?: string;
  stripeCustomerId?: string;

  // Period fields
  currentPeriodStart?: string; // ISO
  currentPeriodEnd?: string; // ISO

  // Plan resolution
  plan?: TenantPlanTier;
  scheduledPlan?: TenantPlanTier | null;
  scheduledPlanAt?: Timestamp | null;
  scheduledPlanReason?: string | null;

  // Audit metadata
  syncedAt?: string; // ISO; written every call
  lastEventId?: string; // Stripe event id when call originated from a webhook
}

/**
 * Caller-facing parameter shape for the extended single writer.
 * Plan 02 implements; all consolidation targets in Plan 03 build their
 * call against THIS interface.
 *
 * Top-level fields are flat; subscription.* fields are nested under
 * `subscription` to make the partition explicit at the call site.
 */
export interface SyncTenantPlanBillingSnapshotParams {
  tenantId: string;

  // Top-level field writes (kept alongside subscription.* per reader audit)
  subscriptionStatus: string; // required — every billing write sets it
  stripePriceId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string | null; // null clears the field (e.g. subscription deleted)
  currentPeriodEnd?: Date; // converted to ISO inside the function
  cancelAtPeriodEnd?: boolean;
  cancelAt?: Date | null;
  cancelScheduledAt?: string | null;
  pastDueSince?: string | null; // explicit override; otherwise derived from status
  trialEndsAt?: string | null;
  plan?: TenantPlanTier; // when explicitly provided (e.g. updateUserPlan)
  scheduledPlan?: TenantPlanTier | null;
  scheduledPlanAt?: Date | Timestamp | null;
  scheduledPlanReason?: string | null;
  billingInterval?: "monthly" | "yearly";

  // Behavior flags
  clearScheduled?: boolean; // upgrades/fresh checkouts only — clears scheduledPlan/At/Reason

  // Audit
  eventId?: string; // Stripe event.id when caller is a webhook
  source?:
    | "webhook.subscription.updated"
    | "webhook.subscription.deleted"
    | "webhook.invoice.payment_failed"
    | "webhook.checkout.completed"
    | "controller.cancelSubscription"
    | "controller.syncSubscription"
    | "controller.confirmCheckoutSession"
    | "controller.createCheckoutSession"
    | "cron.checkStripeSubscriptions"
    | "cron.applyScheduledPlanChanges"
    | "helpers.updateUserPlan"
    | "helpers.runStripeSync"
    | "helpers.upsertTenantStripeBillingData"
    | "on_demand"
    | "admin.updateUserPlan"
    | "admin.forceSetTenantPlan";
}
