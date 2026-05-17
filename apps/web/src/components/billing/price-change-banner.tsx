"use client";

import { useSyncExternalStore, useState, useMemo, useCallback } from "react";
import { TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { usePriceChange } from "@/hooks/usePriceChange";

const DISMISS_KEY_PREFIX = "price_change_dismissed_";
const DAYS_THRESHOLD = 30;
// Custom event used to notify same-tab subscribers when a key is dismissed
const DISMISS_EVENT = "price-dismiss-change";

/**
 * Sticky informational banner displayed when the tenant's subscription price
 * is scheduled to change on their next renewal cycle (price drift detected by
 * the backend cron). Only visible within 30 days of the renewal date and
 * dismissible per-price-point (reappears if the new price changes again).
 */
export function PriceChangeBanner() {
  const { hasDrift, currentPriceFormatted, newPriceFormatted, renewalDate, cancelUrl } =
    usePriceChange();

  const [now] = useState(() => Date.now());
  const dismissKey = `${DISMISS_KEY_PREFIX}${newPriceFormatted ?? ""}`;

  // useSyncExternalStore is the React-idiomatic pattern for reading from external
  // stores (localStorage). This avoids setState-in-effect anti-pattern while
  // correctly returning the server snapshot (true = dismissed) to prevent SSR flash.
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(DISMISS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(DISMISS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const dismissed = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(dismissKey) === "1",
    () => true, // SSR snapshot: default dismissed to avoid hydration flash
  );

  const daysUntilRenewal = useMemo(
    () => (renewalDate ? Math.ceil((renewalDate.getTime() - now) / (1000 * 60 * 60 * 24)) : 999),
    [renewalDate, now],
  );

  if (!hasDrift || dismissed || daysUntilRenewal > DAYS_THRESHOLD || !renewalDate) {
    return null;
  }

  const formattedDate = renewalDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, "1");
    // Notify same-tab subscribers — storage events only fire for other tabs
    window.dispatchEvent(new Event(DISMISS_EVENT));
  };

  return (
    <div
      role="status"
      data-testid="price-change-banner"
      className="w-full bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-700 px-4 py-2.5"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="text-sm text-amber-800 dark:text-amber-200 truncate">
            O valor do seu plano será atualizado de{" "}
            <span className="line-through text-amber-600 dark:text-amber-400">
              {currentPriceFormatted}
            </span>{" "}
            para{" "}
            <strong className="font-semibold">{newPriceFormatted}/mês</strong> em{" "}
            {formattedDate}.{" "}
            <Link
              href={cancelUrl}
              className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
            >
              Cancelar assinatura
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar aviso de mudança de preço"
          className="flex-shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
