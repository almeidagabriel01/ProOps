/** 7-day paid trial state, derived from the tenant subscription snapshot. */
export interface TrialInfo {
  isTrialing: boolean;
  daysRemaining: number; // whole calendar days to the end date, 0 once expired
  endsAt: string | null; // ISO trial end, or null when not trialing
}

/**
 * Pure derivation of the trial countdown. `daysRemaining` is the number of whole
 * CALENDAR days from today to the trial-end date. Counting date boundaries
 * (rather than the raw millisecond diff) keeps the value stable and intuitive: a
 * fresh 7-day trial always reads 7 — immune to time-of-day and small clock skew,
 * so the header banner and the profile can never disagree by a day (which a raw
 * `Math.ceil` at the ~7.0-day boundary would). A trial ending later today reads
 * 0 ("ends today"); floors at 0 once expired.
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
  const startOfLocalDay = (ms: number): number => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const dayMs = 1000 * 60 * 60 * 24;
  const diffDays =
    (startOfLocalDay(new Date(endsAt).getTime()) - startOfLocalDay(nowMs)) /
    dayMs;
  const daysRemaining = Math.max(0, Math.round(diffDays));
  return { isTrialing: true, daysRemaining, endsAt };
}
