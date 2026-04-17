"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { AI_TIER_LIMITS } from "@/types/ai";

function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getResetDate(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

interface UsageState {
  messagesUsed: number;
  totalTokensUsed: number;
  /** Subscription key that produced this data — used to detect stale state */
  subscriptionKey: string | null;
}

const INITIAL_USAGE: UsageState = {
  messagesUsed: 0,
  totalTokensUsed: 0,
  subscriptionKey: null,
};

export interface UseLiaUsageReturn {
  /** Messages used this month */
  messagesUsed: number;
  /** Monthly message limit for current plan */
  messagesLimit: number;
  /** Total tokens used this month */
  totalTokensUsed: number;
  /** Whether usage is >= 80% of limit */
  isNearLimit: boolean;
  /** Whether usage has hit the limit */
  isAtLimit: boolean;
  /** Human-readable reset date (e.g. "01 de maio") */
  resetDate: string;
  /** Whether the usage data is loading */
  isLoading: boolean;
}

/**
 * Reads AI usage in real-time from Firestore tenants/{tenantId}/aiUsage/{YYYY-MM}.
 * Derives messagesLimit from plan tier via AI_TIER_LIMITS.
 * Returns isNearLimit (>= 80%) and isAtLimit (>= messagesLimit).
 */
export function useLiaUsage(): UseLiaUsageReturn {
  const { tenant } = useTenant();
  const { planTier, isLoading: isPlanLoading } = usePlanLimits();

  const tenantId = tenant?.id ?? null;
  const tierConfig = AI_TIER_LIMITS[planTier ?? "starter"];
  const messagesLimit = tierConfig?.messagesPerMonth ?? AI_TIER_LIMITS.starter.messagesPerMonth;

  const [usage, setUsage] = useState<UsageState>(INITIAL_USAGE);

  const yearMonth = getCurrentYearMonth();
  const subscriptionKey = tenantId ? `${tenantId}:${yearMonth}` : null;

  useEffect(() => {
    if (!tenantId) return;

    const key = `${tenantId}:${yearMonth}`;
    const docRef = doc(db, "tenants", tenantId, "aiUsage", yearMonth);

    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUsage({
            messagesUsed: data.messagesUsed ?? 0,
            totalTokensUsed: data.totalTokensUsed ?? 0,
            subscriptionKey: key,
          });
        } else {
          setUsage({ messagesUsed: 0, totalTokensUsed: 0, subscriptionKey: key });
        }
      },
      (error) => {
        console.error("[useLiaUsage] Firestore onSnapshot error:", error);
        setUsage({ messagesUsed: 0, totalTokensUsed: 0, subscriptionKey: key });
      },
    );

    return () => unsubscribe();
  }, [tenantId, yearMonth]);

  // isLoading is true while the plan tier is resolving OR usage hasn't been populated yet.
  // isPlanLoading prevents the badge from briefly showing the "starter" default limit (80)
  // before the real plan (e.g. pro=400) is fetched from Firestore.
  const isLoading =
    isPlanLoading || (!!tenantId && usage.subscriptionKey !== subscriptionKey);

  const isNearLimit = usage.messagesUsed >= Math.floor(messagesLimit * 0.8);
  const isAtLimit = usage.messagesUsed >= messagesLimit;

  return {
    messagesUsed: usage.messagesUsed,
    messagesLimit,
    totalTokensUsed: usage.totalTokensUsed,
    isNearLimit,
    isAtLimit,
    resetDate: getResetDate(),
    isLoading,
  };
}
