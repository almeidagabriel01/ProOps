/**
 * Cross-navigation loop breaker for the `/auth/refresh` interstitial.
 *
 * The interstitial's attempt budget and watchdog only bound a single page
 * load. If the proxy keeps rejecting the freshly minted cookie, the user
 * bounces `protected route → /auth/refresh → protected route → …` across
 * navigations, and nothing on a single mount can see that. This module counts
 * `redirect-next` events (NOT mounts — the soft bounce reuses the mounted
 * component, and strict-mode double-mounts would double-count) in
 * sessionStorage and breaks the loop to /login after `maxVisits` redirects
 * inside `windowMs`.
 *
 * All storage IO is fail-open: with sessionStorage unavailable the breaker
 * never fires and the interstitial's watchdog remains the absolute ceiling.
 */
export const REFRESH_VISITS_KEY = "proops.auth-refresh.visits";

const DEFAULT_WINDOW_MS = 30_000;
const DEFAULT_MAX_VISITS = 3;

export interface RefreshVisitRecord {
  count: number;
  firstAt: number;
}

export interface RefreshVisitDecision {
  shouldBreak: boolean;
  record: RefreshVisitRecord;
}

export function parseRefreshVisitRecord(
  raw: string | null,
): RefreshVisitRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RefreshVisitRecord> | null;
    if (
      !parsed ||
      typeof parsed.count !== "number" ||
      typeof parsed.firstAt !== "number" ||
      !Number.isFinite(parsed.count) ||
      !Number.isFinite(parsed.firstAt) ||
      parsed.count <= 0 ||
      parsed.firstAt < 0
    ) {
      return null;
    }
    return { count: parsed.count, firstAt: parsed.firstAt };
  } catch {
    return null;
  }
}

/**
 * Pure core: given the previous record (or null) and the current time,
 * register one redirect and decide whether the loop must be broken.
 */
export function decideRefreshVisit(
  prev: RefreshVisitRecord | null,
  now: number,
  opts?: { windowMs?: number; maxVisits?: number },
): RefreshVisitDecision {
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxVisits = opts?.maxVisits ?? DEFAULT_MAX_VISITS;

  const withinWindow = prev !== null && now - prev.firstAt <= windowMs;
  const record: RefreshVisitRecord = withinWindow
    ? { count: prev.count + 1, firstAt: prev.firstAt }
    : { count: 1, firstAt: now };

  return { shouldBreak: record.count >= maxVisits, record };
}

/** Register a redirect-next event. Fail-open on any storage error. */
export function recordRefreshRedirect(now: number): { shouldBreak: boolean } {
  try {
    const prev = parseRefreshVisitRecord(
      window.sessionStorage.getItem(REFRESH_VISITS_KEY),
    );
    const { shouldBreak, record } = decideRefreshVisit(prev, now);
    window.sessionStorage.setItem(REFRESH_VISITS_KEY, JSON.stringify(record));
    return { shouldBreak };
  } catch {
    return { shouldBreak: false };
  }
}

export function clearRefreshVisits(): void {
  try {
    window.sessionStorage.removeItem(REFRESH_VISITS_KEY);
  } catch {
    // fail-open
  }
}
