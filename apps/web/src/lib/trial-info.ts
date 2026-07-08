/** 7-day paid trial state, derived from the tenant subscription snapshot. */
export interface TrialInfo {
  isTrialing: boolean;
  daysRemaining: number; // full days left (ceil), 0 once expired
  endsAt: string | null; // ISO trial end, or null when not trialing
}

/**
 * Pure derivation of the trial countdown. `daysRemaining` is ceil'd so a trial
 * ending in 6h still reads as "1 day", and floors at 0 once expired.
 */
export function computeTrialInfo(
  subscriptionStatus: string | null | undefined,
  trialEndsAt: string | null | undefined,
  nowMs: number = Date.now(),
): TrialInfo {
  const isTrialing = subscriptionStatus === "trialing";
  const endsAt = trialEndsAt ?? null;
  if (!isTrialing || !endsAt) {
    return { isTrialing: false, daysRemaining: 0, endsAt: null };
  }
  const diffTime = new Date(endsAt).getTime() - nowMs;
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  return { isTrialing: true, daysRemaining, endsAt };
}
