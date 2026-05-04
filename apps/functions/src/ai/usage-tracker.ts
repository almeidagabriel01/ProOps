import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { db } from "../init";
import { AI_LIMITS, type AiUsageDocument, type TenantPlanTier } from "./ai.types";
import {
  buildMonthlyPeriodKeyUtc,
  buildMonthlyPeriodWindowUtc,
} from "../lib/tenant-plan-policy";

export interface AiLimitCheckResult {
  allowed: boolean;
  messagesUsed: number;
  messagesLimit: number;
  resetAt: string;        // ISO 8601 date when the limit resets (1st of next month)
}

/**
 * Path helper: tenants/{tenantId}/aiUsage/{YYYY-MM}
 */
function getUsageDocRef(tenantId: string, monthKey?: string) {
  const key = monthKey || buildMonthlyPeriodKeyUtc();
  return db.collection("tenants").doc(tenantId).collection("aiUsage").doc(key);
}

/**
 * Check if the tenant has remaining AI messages for this month.
 * Returns allowed=true if under limit, false if exhausted.
 * Free tier should be blocked BEFORE calling this (in the route handler with 403).
 */
export async function checkAiLimit(
  tenantId: string,
  planTier: Exclude<TenantPlanTier, "free">,
): Promise<AiLimitCheckResult> {
  const config = AI_LIMITS[planTier];
  const monthKey = buildMonthlyPeriodKeyUtc();
  const period = buildMonthlyPeriodWindowUtc();

  const docRef = getUsageDocRef(tenantId, monthKey);
  const snap = await docRef.get();

  const messagesUsed = snap.exists
    ? (snap.data() as AiUsageDocument).messagesUsed || 0
    : 0;

  return {
    allowed: messagesUsed < config.messagesPerMonth,
    messagesUsed,
    messagesLimit: config.messagesPerMonth,
    resetAt: period.resetAt,
  };
}

/**
 * Atomically increment the message and token counters for this month.
 * Uses set with merge:true so the first call of the month creates the document.
 */
export async function incrementAiUsage(
  tenantId: string,
  tokensUsed: number,
): Promise<void> {
  const monthKey = buildMonthlyPeriodKeyUtc();
  const docRef = getUsageDocRef(tenantId, monthKey);

  await docRef.set(
    {
      tenantId,
      month: monthKey,
      messagesUsed: FieldValue.increment(1),
      totalTokensUsed: FieldValue.increment(tokensUsed),
      lastUpdatedAt: Timestamp.now(),
    },
    { merge: true },
  );
}

/**
 * Pre-debit: atomically reserve 1 message slot before the stream begins.
 * Call refundAiMessage() in a finally block if the stream does not complete.
 */
export async function reserveAiMessage(tenantId: string): Promise<void> {
  const monthKey = buildMonthlyPeriodKeyUtc();
  const docRef = getUsageDocRef(tenantId, monthKey);
  await docRef.set(
    {
      tenantId,
      month: monthKey,
      messagesUsed: FieldValue.increment(1),
      lastUpdatedAt: Timestamp.now(),
    },
    { merge: true },
  );
}

/**
 * Finalize token usage after a successful stream.
 * Message counter was already incremented by reserveAiMessage — only tokens are added here.
 */
export async function finalizeTokenUsage(tenantId: string, tokensUsed: number): Promise<void> {
  const monthKey = buildMonthlyPeriodKeyUtc();
  const docRef = getUsageDocRef(tenantId, monthKey);
  await docRef.set(
    {
      tenantId,
      month: monthKey,
      totalTokensUsed: FieldValue.increment(tokensUsed),
      lastUpdatedAt: Timestamp.now(),
    },
    { merge: true },
  );
}

/**
 * Refund a pre-debited message slot.
 * Called when the stream errored, was canceled, or returned a confirmation request
 * (confirmation not yet acted upon — the counter will be re-reserved on the next request).
 */
export async function refundAiMessage(tenantId: string): Promise<void> {
  const monthKey = buildMonthlyPeriodKeyUtc();
  const docRef = getUsageDocRef(tenantId, monthKey);
  await docRef.set(
    {
      tenantId,
      month: monthKey,
      messagesUsed: FieldValue.increment(-1),
      lastUpdatedAt: Timestamp.now(),
    },
    { merge: true },
  );
}

/**
 * Read the current AI usage for a tenant in the current month.
 * Returns null if no usage document exists yet.
 */
export async function getAiUsage(
  tenantId: string,
): Promise<AiUsageDocument | null> {
  const monthKey = buildMonthlyPeriodKeyUtc();
  const docRef = getUsageDocRef(tenantId, monthKey);
  const snap = await docRef.get();

  if (!snap.exists) return null;
  return snap.data() as AiUsageDocument;
}
