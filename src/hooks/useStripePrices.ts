"use client";

import { useState, useEffect, useCallback } from "react";
import { StripeService } from "@/services/stripe-service";

interface PriceInfo {
  id: string;
  amount: number; // in cents
  currency: string;
  interval: "monthly" | "yearly";
  productId: string;
  productName?: string;
}

interface PriceSet {
  monthly: PriceInfo | null;
  yearly: PriceInfo | null;
}

interface StripePricesData {
  plans: Record<string, PriceSet>;
  addons: Record<string, PriceSet>;
  cached?: boolean;
  stale?: boolean;
}

interface UseStripePricesReturn {
  prices: StripePricesData | null;
  isLoading: boolean;
  error: string | null;

  // Helper functions
  getPlanPrice: (tier: string, interval: "monthly" | "yearly") => number;
  getAddonPrice: (addonType: string, interval: "monthly" | "yearly") => number;

  // Format price for display
  formatPrice: (priceInCents: number, currency?: string) => string;

  // Refresh prices
  refresh: () => Promise<void>;
}

export function useStripePrices(): UseStripePricesReturn {
  const [prices, setPrices] = useState<StripePricesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use Cloud Function via StripeService instead of local API route
      const data = await StripeService.getPrices();
      setPrices(data as unknown as StripePricesData);
    } catch (err) {
      console.error("Error fetching prices:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch prices");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Get plan price in cents (returns 0 if not found)
  const getPlanPrice = useCallback(
    (tier: string, interval: "monthly" | "yearly"): number => {
      if (!prices?.plans?.[tier]) return 0;
      return prices.plans[tier][interval]?.amount || 0;
    },
    [prices],
  );

  // Get add-on price in cents (returns 0 if not found)
  // NOTE: Returns value in CENTS. Dividy by 100 for display.
  const getAddonPrice = useCallback(
    (addonType: string, interval: "monthly" | "yearly"): number => {
      if (!prices?.addons?.[addonType]) return 0;
      return prices.addons[addonType][interval]?.amount || 0;
    },
    [prices],
  );

  // Format price for display (converts cents to currency)
  const formatPrice = useCallback(
    (priceInCents: number, currency: string = "BRL"): string => {
      const amount = priceInCents / 100;
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: currency.toUpperCase(),
      }).format(amount);
    },
    [],
  );

  return {
    prices,
    isLoading,
    error,
    getPlanPrice,
    getAddonPrice,
    formatPrice,
    refresh: fetchPrices,
  };
}
