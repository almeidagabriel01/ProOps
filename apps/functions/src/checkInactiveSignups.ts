import { onSchedule } from "firebase-functions/v2/scheduler";
import type {
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { logger } from "./lib/logger";
import { resolveFrontendAppOrigin } from "./lib/frontend-app-url";
import { sendEmail } from "./services/email/send-email";
import { renderNoSubscriptionReminderEmail } from "./services/email/templates/no-subscription-reminder";

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_TYPE = "no_subscription_reminder";
// Landing page pricing section (same target as the header "Ver planos" button,
// which scrolls to <section id="pricing"> on the marketing root route).
const LANDING_PRICING_PATH = "/#pricing";

/**
 * Pure eligibility check for the "no subscription after 2 days" reminder.
 * Eligible = free tenant owner that never subscribed and was not yet reminded.
 *
 * - role must be "free" (self-signup owners stay on the free tier)
 * - must have an email to send to
 * - absence of stripeCustomerId distinguishes "never subscribed" from
 *   "subscribed then canceled" (the Stripe webhook keeps stripeCustomerId)
 * - noSubscriptionReminderSentAt acts as the single-send idempotency marker
 */
export function isEligibleForNoSubscriptionReminder(user: {
  role?: unknown;
  email?: unknown;
  stripeCustomerId?: unknown;
  noSubscriptionReminderSentAt?: unknown;
}): boolean {
  const role = String(user.role ?? "").trim().toLowerCase();
  if (role !== "free") return false;

  const email = String(user.email ?? "").trim();
  if (!email) return false;

  const stripeCustomerId = String(user.stripeCustomerId ?? "").trim();
  if (stripeCustomerId) return false;

  if (user.noSubscriptionReminderSentAt) return false;

  return true;
}

export interface NoSubscriptionReminderOptions {
  /** Minimum account age, in days, to be eligible. Default: 2. */
  olderThanDays?: number;
  /**
   * Upper bound on account age, in days. When set, only accounts created
   * within [now - lowerBoundDays, now - olderThanDays] are scanned (sliding
   * window — used by the daily cron). Omit to drain the full backlog.
   */
  lowerBoundDays?: number;
  /** Page size per Firestore query. Default: 300. */
  batchLimit?: number;
  /** Hard cap on docs scanned in a single invocation. Default: 1000. */
  maxTotal?: number;
  /** When true, count what would be sent without sending or writing markers. */
  dryRun?: boolean;
  /** Optional delay between sends (ms) to respect provider rate limits. */
  sendDelayMs?: number;
}

export interface NoSubscriptionReminderResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: number;
  dryRun: boolean;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core routine shared by the daily cron and the manual backlog endpoint.
 * Paginates by document cursor so already-reminded docs never stall progress
 * within a single invocation.
 */
export async function runNoSubscriptionReminder(
  options: NoSubscriptionReminderOptions = {},
): Promise<NoSubscriptionReminderResult> {
  const olderThanDays = options.olderThanDays ?? 2;
  const batchLimit = Math.max(1, options.batchLimit ?? 300);
  const maxTotal = Math.max(batchLimit, options.maxTotal ?? 1000);
  const dryRun = options.dryRun === true;
  const sendDelayMs = Math.max(0, options.sendDelayMs ?? 0);

  const now = Date.now();
  const cutoffUpperIso = new Date(now - olderThanDays * DAY_MS).toISOString();
  const cutoffLowerIso =
    options.lowerBoundDays != null
      ? new Date(now - options.lowerBoundDays * DAY_MS).toISOString()
      : null;

  const plansUrl = `${resolveFrontendAppOrigin()}${LANDING_PRICING_PATH}`;

  let scanned = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

  logger.info("[checkInactiveSignups] starting", {
    olderThanDays,
    lowerBoundDays: options.lowerBoundDays ?? null,
    batchLimit,
    maxTotal,
    dryRun,
  });

  while (scanned < maxTotal) {
    // Reuses composite index users(role ASC, createdAt DESC).
    let query = db
      .collection("users")
      .where("role", "==", "free")
      .where("createdAt", "<=", cutoffUpperIso);
    if (cutoffLowerIso) {
      query = query.where("createdAt", ">=", cutoffLowerIso);
    }
    query = query.orderBy("createdAt", "desc").limit(batchLimit);
    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned++;
      cursor = doc;
      const data = doc.data() as Record<string, unknown>;

      if (!isEligibleForNoSubscriptionReminder(data)) {
        skipped++;
        continue;
      }

      const email = String(data.email ?? "").trim();
      const tenantId = String(data.tenantId ?? "").trim() || undefined;
      const recipientName = String(data.name ?? "").trim() || undefined;

      if (dryRun) {
        sent++;
        continue;
      }

      try {
        const { subject, html, text } = renderNoSubscriptionReminderEmail({
          email,
          recipientName,
          plansUrl,
        });

        const result = await sendEmail({
          to: email,
          subject,
          html,
          text,
          type: EMAIL_TYPE,
          tenantId,
        });

        if (!result.ok) {
          errors++;
          continue;
        }

        // Marker written only after a successful send so failures retry later.
        await doc.ref.set(
          {
            noSubscriptionReminderSentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        sent++;
        await sleep(sendDelayMs);
      } catch (err) {
        errors++;
        logger.error("[checkInactiveSignups] error processing user", {
          uid: doc.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (snap.size < batchLimit) break;
  }

  const result: NoSubscriptionReminderResult = {
    scanned,
    sent,
    skipped,
    errors,
    dryRun,
  };
  logger.info("[checkInactiveSignups] complete", { ...result });
  return result;
}

export const remindNoSubscriptionSignups = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "0 14 * * *",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    // Sliding window keeps the daily result set small; the single-send marker
    // prevents duplicates across the days an account stays inside the window.
    await runNoSubscriptionReminder({ lowerBoundDays: 7, batchLimit: 300 });
  },
);
