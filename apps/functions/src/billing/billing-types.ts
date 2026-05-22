export type BillingStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "inactive";

export interface BillingSnapshot {
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  plan: string;
  billingInterval: "monthly" | "yearly";
  subscriptionStatus: BillingStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pastDueSince: string | null;
  billingSyncedAt: string;
  billingSyncing: boolean;
  source: "webhook" | "cron" | "on_demand" | "manual";
  unitAmount?: number | null;
  currency?: string | null;
}

export interface DuplicateCancelResult {
  kept: string;
  canceled: string[];
}
