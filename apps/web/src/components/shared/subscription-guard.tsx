"use client";

import * as React from "react";
import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { FullPageLoading } from "@/components/ui/full-page-loading";
import { useRouter } from "next/navigation";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

const GRACE_PERIOD_DAYS = 7;

const BLOCKED_STATUSES = new Set([
  "canceled",
  "cancelled",
  "unpaid",
  "inactive",
  "payment_failed",
]);

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { tenant, isLoading: isTenantLoading } = useTenant();
  const router = useRouter();
  const [now] = useState(() => Date.now());

  const isLoading = isAuthLoading || isTenantLoading;

  const shouldCheckSubscription = React.useMemo(() => {
    if (!user) return false;
    // superadmin is never blocked — they must be able to access any tenant panel
    if (user.role === "superadmin") return false;
    // "free" role means the account has never had a paid plan — nothing to enforce
    if (user.role === "free") return false;
    const status = tenant?.subscriptionStatus ?? user.subscriptionStatus;
    // subscriptionStatus "free" also means no active subscription to enforce
    if (status === "free") return false;
    return true;
  }, [user, tenant?.subscriptionStatus]);

  // Prefer tenant billing fields (synced from Stripe) over user fields.
  const subscriptionStatus = tenant?.subscriptionStatus ?? user?.subscriptionStatus;
  const currentPeriodEnd = tenant?.currentPeriodEnd ?? user?.currentPeriodEnd ?? null;
  const cancelAtPeriodEnd = tenant?.cancelAtPeriodEnd ?? user?.cancelAtPeriodEnd;
  // pastDueSince is set by the Stripe webhook at the first failed payment attempt.
  // If absent for a past_due tenant, we treat the grace period as expired to match
  // the behavior of billing-status/route.ts and require-active-subscription.ts.
  const pastDueSince = tenant?.pastDueSince ?? null;

  const { isGracePeriodExpired } = React.useMemo(() => {
    if (subscriptionStatus !== "past_due") {
      return { isGracePeriodExpired: false };
    }
    if (!pastDueSince) {
      // No reference date — consistent with billing-status route: treat as expired.
      return { isGracePeriodExpired: true };
    }
    const referenceMs = Date.parse(pastDueSince);
    if (!Number.isFinite(referenceMs)) {
      return { isGracePeriodExpired: true };
    }
    const graceMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    return { isGracePeriodExpired: now - referenceMs > graceMs };
  }, [subscriptionStatus, pastDueSince, now]);

  // Compute block decision synchronously during render so children are never
  // painted when the subscription is blocked. The redirect is a side effect
  // and stays in useEffect, but returning null here prevents the flash of
  // unprotected content that would otherwise occur before useEffect runs.
  const isBlocked = React.useMemo(() => {
    if (!shouldCheckSubscription || isLoading) return false;

    if (subscriptionStatus && BLOCKED_STATUSES.has(subscriptionStatus)) {
      return true;
    }

    if (subscriptionStatus === "past_due" && isGracePeriodExpired) {
      return true;
    }

    if (cancelAtPeriodEnd && currentPeriodEnd) {
      const periodEndDate = new Date(currentPeriodEnd);
      if (
        !Number.isNaN(periodEndDate.getTime()) &&
        periodEndDate.getTime() <= now
      ) {
        return true;
      }
    }

    return false;
  }, [
    shouldCheckSubscription,
    isLoading,
    subscriptionStatus,
    isGracePeriodExpired,
    cancelAtPeriodEnd,
    currentPeriodEnd,
    now,
  ]);

  // Secondary action: navigate to the blocked page. The render already returns
  // null above so the user never sees protected content even on the first cycle.
  // Reason is derived here so the Firestore-snapshot-triggered redirect (which
  // can fire before the cancel API response returns) already carries the correct
  // ?reason param — preventing a flash of the wrong modal on /subscription-blocked.
  React.useEffect(() => {
    if (isBlocked) {
      let reason: string;
      if (subscriptionStatus && BLOCKED_STATUSES.has(subscriptionStatus)) {
        reason = subscriptionStatus;
      } else if (subscriptionStatus === "past_due") {
        reason = "past_due";
      } else if (cancelAtPeriodEnd) {
        reason = "canceled";
      } else {
        reason = "inactive";
      }
      router.replace(`/subscription-blocked?reason=${reason}`);
    }
  }, [isBlocked, router, subscriptionStatus, cancelAtPeriodEnd]);

  // bfcache restoration guard: when the browser restores a page from the
  // back-forward cache (event.persisted === true), React state is frozen at
  // cache-time and isBlocked is stale. Always force a middleware round-trip
  // instead of reading the stale closure — middleware will redirect if access
  // has since been revoked.
  React.useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        router.replace(window.location.pathname);
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [router]);

  if (isLoading) {
    return <FullPageLoading />;
  }

  if (isBlocked) {
    return null;
  }

  return <>{children}</>;
}
