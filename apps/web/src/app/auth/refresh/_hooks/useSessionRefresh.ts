"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";
import { decideRefreshOutcome } from "@/lib/auth/decide-refresh-outcome";

/** Bounded re-mint attempts before giving up and bouncing to /login. */
const MAX_REFRESH_ATTEMPTS = 2;
/** Absolute ceiling: the interstitial can NEVER spin longer than this. */
const REFRESH_WATCHDOG_MS = 10_000;

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
 * Deterministic, state-driven session recovery. Replaces the old fixed-4000ms
 * `setTimeout` recovery on the login page. When a Firebase user is still signed
 * in (refresh token valid), it re-mints the `__session` cookie via
 * `forceSyncSession` — bounded by attempt count AND a hard watchdog — then sends
 * the user to their intended path. Every terminal outcome is guaranteed: success
 * → `next`, any failure → `/login`. Never loops, never hangs.
 */
export function useSessionRefresh(): void {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isSessionSynced, whatsappMfaPending, forceSyncSession } =
    useAuth();

  const [attemptsUsed, setAttemptsUsed] = React.useState(0);
  const [watchdogFired, setWatchdogFired] = React.useState(false);
  const attemptingRef = React.useRef(false);
  const doneRef = React.useRef(false);

  const next = React.useMemo(
    () => sanitizeNext(searchParams.get("next")),
    [searchParams],
  );

  // Independent watchdog: forces a terminal failure if neither success nor a
  // bounded-attempt failure has fired by the ceiling.
  React.useEffect(() => {
    const timer = setTimeout(() => setWatchdogFired(true), REFRESH_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (doneRef.current) return;

    // `isLoading` (auth init) doubles as "auth not ready yet". `hasUser` reads
    // the live SDK value too, since `user` (Firestore-backed) may lag the raw
    // Firebase identity by a tick.
    const outcome = decideRefreshOutcome({
      authReady: !isLoading,
      hasUser: Boolean(user) || Boolean(auth.currentUser),
      isSessionSynced,
      whatsappPending: whatsappMfaPending !== null,
      attemptsUsed,
      maxAttempts: MAX_REFRESH_ATTEMPTS,
      watchdogFired,
    });

    if (outcome === "redirect-next") {
      doneRef.current = true;
      router.replace(next);
      return;
    }
    if (outcome === "redirect-login") {
      doneRef.current = true;
      router.replace("/login?redirect_reason=session_expired");
      return;
    }

    // outcome === "retry": only act once auth is ready and no attempt is running.
    if (isLoading) return;
    if (attemptingRef.current) return;

    attemptingRef.current = true;
    void forceSyncSession().finally(() => {
      attemptingRef.current = false;
      // Count the attempt regardless of result. On success the provider flips
      // isSessionSynced (→ redirect-next); on failure this increment eventually
      // exhausts the budget (→ redirect-login). Either way re-evaluates.
      setAttemptsUsed((n) => n + 1);
    });
  }, [
    isLoading,
    user,
    isSessionSynced,
    whatsappMfaPending,
    attemptsUsed,
    watchdogFired,
    forceSyncSession,
    router,
    next,
  ]);
}
