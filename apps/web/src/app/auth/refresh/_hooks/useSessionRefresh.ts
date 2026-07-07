"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";
import { decideRefreshOutcome } from "@/lib/auth/decide-refresh-outcome";
import {
  clearRefreshVisits,
  recordRefreshRedirect,
} from "@/lib/auth/refresh-visit-breaker";

/** Bounded re-mint attempts before giving up and bouncing to /login. */
const MAX_REFRESH_ATTEMPTS = 2;
/** Absolute ceiling: the interstitial can NEVER spin longer than this. */
const REFRESH_WATCHDOG_MS = 10_000;

const LOGIN_FALLBACK = "/login?redirect_reason=session_expired";

/**
 * Validates the `?next=` target as an internal path to prevent an open redirect.
 * RBAC is still enforced downstream by the proxy + ProtectedRoute; here we only
 * guarantee the destination is same-origin. Defaults to `/dashboard`.
 */
function sanitizeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const isInternal = decoded.startsWith("/") && !decoded.startsWith("//");
  return isInternal ? decoded : "/dashboard";
}

/**
 * Deterministic, state-driven session recovery. When a Firebase user is still
 * signed in (refresh token valid), it re-mints the `__session` cookie via
 * `forceSyncSession({ force: true })` — a REAL re-mint every visit; the
 * provider's stale `isSessionSynced` is deliberately ignored because the proxy
 * only sends users here after rejecting/clearing the cookie.
 *
 * Three loop guards, each covering a distinct failure shape:
 * - bounded attempts (mint keeps failing on this mount) → /login;
 * - watchdog that fires EVEN AFTER a redirect-next was issued (the proxy can
 *   bounce that navigation straight back to this same URL without remounting,
 *   which used to leave the effect permanently dead behind `doneRef`) → /login;
 * - sessionStorage redirect counter (proxy keeps bouncing across remounts:
 *   3 redirect-next events within 30s) → /login.
 */
export function useSessionRefresh(): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, whatsappMfaPending, forceSyncSession } = useAuth();

  const [attemptsUsed, setAttemptsUsed] = React.useState(0);
  const [watchdogFired, setWatchdogFired] = React.useState(false);
  // A fresh, successful re-mint happened during THIS interstitial visit.
  const [freshSyncDone, setFreshSyncDone] = React.useState(false);
  const attemptingRef = React.useRef(false);
  const doneRef = React.useRef(false);
  const watchdogHandledRef = React.useRef(false);

  const next = React.useMemo(
    () => sanitizeNext(searchParams.get("next")),
    [searchParams],
  );

  // Independent watchdog: forces a terminal failure if the interstitial is
  // still mounted at the ceiling — including after a redirect-next whose
  // navigation bounced back here.
  React.useEffect(() => {
    const timer = setTimeout(() => setWatchdogFired(true), REFRESH_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (doneRef.current) {
      // A redirect was already issued but we are STILL mounted — the proxy
      // bounced it back to this same URL (no remount). The watchdog state
      // transition revives this otherwise-dead effect; bail to /login once.
      if (!watchdogFired || watchdogHandledRef.current) return;
      watchdogHandledRef.current = true;
      clearRefreshVisits();
      router.replace(LOGIN_FALLBACK);
      return;
    }

    // `isLoading` (auth init) doubles as "auth not ready yet". `hasUser` reads
    // the live SDK value too, since `user` (Firestore-backed) may lag the raw
    // Firebase identity by a tick.
    const outcome = decideRefreshOutcome({
      authReady: !isLoading,
      hasUser: Boolean(user) || Boolean(auth.currentUser),
      syncedThisVisit: freshSyncDone,
      whatsappPending: whatsappMfaPending !== null,
      attemptsUsed,
      maxAttempts: MAX_REFRESH_ATTEMPTS,
      watchdogFired,
    });

    if (outcome === "redirect-next") {
      doneRef.current = true;
      // Cross-navigation loop breaker: if the proxy keeps rejecting freshly
      // minted cookies, each remounted visit "succeeds" and redirects again.
      // 3 redirect-next events within 30s → terminal /login instead.
      const { shouldBreak } = recordRefreshRedirect(Date.now());
      if (shouldBreak) {
        clearRefreshVisits();
        router.replace(LOGIN_FALLBACK);
        return;
      }
      router.replace(next);
      return;
    }
    if (outcome === "redirect-login") {
      doneRef.current = true;
      clearRefreshVisits();
      router.replace(LOGIN_FALLBACK);
      return;
    }

    // outcome === "retry": only act once auth is ready and no attempt is running.
    if (isLoading) return;
    if (attemptingRef.current) return;

    attemptingRef.current = true;
    void forceSyncSession({ force: true })
      .then((ok) => {
        if (ok) setFreshSyncDone(true);
      })
      .finally(() => {
        attemptingRef.current = false;
        // Count the attempt regardless of result. On success `freshSyncDone`
        // flips (→ redirect-next); on failure this increment eventually
        // exhausts the budget (→ redirect-login). Either way re-evaluates.
        setAttemptsUsed((n) => n + 1);
      });
  }, [
    isLoading,
    user,
    freshSyncDone,
    whatsappMfaPending,
    attemptsUsed,
    watchdogFired,
    forceSyncSession,
    router,
    next,
  ]);
}
