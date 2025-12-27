/**
 * Stripe Prices Cloud Function
 *
 * Fetches prices from Stripe with caching.
 * Migrated from: src/app/api/stripe/prices/route.ts
 */

import * as functions from "firebase-functions";
import { getStripe, getPriceConfig, BillingInterval } from "./stripeConfig";
import Stripe from "stripe";

// Cache for prices (in-memory, resets on cold start)
let priceCache: {
  data: PricesResponse | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

// Cache duration: 1 hour (in milliseconds)
const CACHE_DURATION = 60 * 60 * 1000;

interface PriceInfo {
  id: string;
  amount: number;
  currency: string;
  interval: BillingInterval;
  productId: string;
  productName?: string;
}

interface PricesResponse {
  plans: Record<
    string,
    { monthly: PriceInfo | null; yearly: PriceInfo | null }
  >;
  addons: Record<
    string,
    { monthly: PriceInfo | null; yearly: PriceInfo | null }
  >;
  cached?: boolean;
  cacheAge?: number;
  stale?: boolean;
}

async function fetchPriceFromStripe(
  stripe: Stripe,
  priceId: string
): Promise<PriceInfo | null> {
  if (!priceId) return null;

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ["product"],
    });

    const product = price.product as Stripe.Product;

    return {
      id: price.id,
      amount: price.unit_amount || 0,
      currency: price.currency,
      interval: price.recurring?.interval === "year" ? "yearly" : "monthly",
      productId: typeof price.product === "string" ? price.product : product.id,
      productName: product?.name,
    };
  } catch (error) {
    console.error(`Error fetching price ${priceId}:`, error);
    return null;
  }
}

async function fetchAllPrices(): Promise<PricesResponse> {
  const stripe = getStripe();
  const config = getPriceConfig();

  const result: PricesResponse = {
    plans: {},
    addons: {},
  };

  // Fetch plan prices in parallel
  const planTiers = Object.keys(config.plans);
  const planPromises = planTiers.map(async (tier) => {
    const tierPrices = config.plans[tier];
    const [monthly, yearly] = await Promise.all([
      fetchPriceFromStripe(stripe, tierPrices.monthly),
      fetchPriceFromStripe(stripe, tierPrices.yearly),
    ]);
    return { tier, monthly, yearly };
  });

  // Fetch add-on prices in parallel
  const addonTypes = Object.keys(config.addons);
  const addonPromises = addonTypes.map(async (addonType) => {
    const addonPrices = config.addons[addonType];
    const monthly = await fetchPriceFromStripe(stripe, addonPrices.monthly);
    return { addonType, monthly, yearly: null };
  });

  // Execute all fetches
  const [plans, addons] = await Promise.all([
    Promise.all(planPromises),
    Promise.all(addonPromises),
  ]);

  // key: tier -> value
  plans.forEach(({ tier, monthly, yearly }) => {
    result.plans[tier] = { monthly, yearly };
  });

  addons.forEach(({ addonType, monthly, yearly }) => {
    result.addons[addonType] = { monthly, yearly };
  });

  return result;
}

// Get prices (with caching)
export const stripePrices = functions
  .region("southamerica-east1")
  .https.onCall(async (): Promise<PricesResponse> => {
    try {
      const now = Date.now();

      // Check if cache is valid
      if (priceCache.data && now - priceCache.timestamp < CACHE_DURATION) {
        return {
          ...priceCache.data,
          cached: true,
          cacheAge: Math.round((now - priceCache.timestamp) / 1000),
        };
      }

      // Fetch fresh prices from Stripe
      const prices = await fetchAllPrices();

      // Update cache
      priceCache = {
        data: prices,
        timestamp: now,
      };

      return {
        ...prices,
        cached: false,
      };
    } catch (error) {
      console.error("Error fetching prices from Stripe:", error);

      // Return stale cache if available
      if (priceCache.data) {
        return {
          ...priceCache.data,
          cached: true,
          stale: true,
        };
      }

      throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch prices"
      );
    }
  });

// Force cache refresh
export const stripePricesRefresh = functions
  .region("southamerica-east1")
  .https.onCall(async (): Promise<PricesResponse> => {
    try {
      const prices = await fetchAllPrices();

      priceCache = {
        data: prices,
        timestamp: Date.now(),
      };

      return {
        ...prices,
        cached: false,
      };
    } catch (error) {
      console.error("Error refreshing prices:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to refresh prices"
      );
    }
  });
