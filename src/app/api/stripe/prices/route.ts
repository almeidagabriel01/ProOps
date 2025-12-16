import { NextRequest, NextResponse } from 'next/server';
import { getStripe, STRIPE_PRICE_IDS, STRIPE_ADDON_PRICE_IDS, BillingInterval } from '@/lib/stripe';
import Stripe from 'stripe';

// Cache for prices (in-memory, resets on server restart)
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
  amount: number; // in cents
  currency: string;
  interval: BillingInterval;
  productId: string;
  productName?: string;
}

interface PricesResponse {
  plans: Record<string, { monthly: PriceInfo | null; yearly: PriceInfo | null }>;
  addons: Record<string, { monthly: PriceInfo | null; yearly: PriceInfo | null }>;
}

async function fetchPriceFromStripe(stripe: Stripe, priceId: string): Promise<PriceInfo | null> {
  if (!priceId) return null;

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product'],
    });

    const product = price.product as Stripe.Product;

    return {
      id: price.id,
      amount: price.unit_amount || 0,
      currency: price.currency,
      interval: price.recurring?.interval === 'year' ? 'yearly' : 'monthly',
      productId: typeof price.product === 'string' ? price.product : product.id,
      productName: product?.name,
    };
  } catch (error) {
    console.error(`Error fetching price ${priceId}:`, error);
    return null;
  }
}

async function fetchAllPrices(): Promise<PricesResponse> {
  const stripe = getStripe();
  
  const result: PricesResponse = {
    plans: {},
    addons: {},
  };

  // Fetch plan prices
  const planTiers = Object.keys(STRIPE_PRICE_IDS);
  for (const tier of planTiers) {
    const tierPrices = STRIPE_PRICE_IDS[tier];
    
    const [monthly, yearly] = await Promise.all([
      fetchPriceFromStripe(stripe, tierPrices.monthly),
      fetchPriceFromStripe(stripe, tierPrices.yearly),
    ]);

    result.plans[tier] = { monthly, yearly };
  }

  // Fetch add-on prices
  const addonTypes = Object.keys(STRIPE_ADDON_PRICE_IDS);
  for (const addonType of addonTypes) {
    const addonPrices = STRIPE_ADDON_PRICE_IDS[addonType];
    
    const [monthly, yearly] = await Promise.all([
      fetchPriceFromStripe(stripe, addonPrices.monthly),
      fetchPriceFromStripe(stripe, addonPrices.yearly),
    ]);

    result.addons[addonType] = { monthly, yearly };
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Check if cache is valid
    if (priceCache.data && (now - priceCache.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        ...priceCache.data,
        cached: true,
        cacheAge: Math.round((now - priceCache.timestamp) / 1000),
      });
    }

    // Fetch fresh prices from Stripe
    const prices = await fetchAllPrices();

    // Update cache
    priceCache = {
      data: prices,
      timestamp: now,
    };

    return NextResponse.json({
      ...prices,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching prices from Stripe:', error);
    
    // If cache exists but is expired, return stale data with warning
    if (priceCache.data) {
      return NextResponse.json({
        ...priceCache.data,
        cached: true,
        stale: true,
        error: 'Failed to refresh prices',
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

// Force cache refresh
export async function POST(request: NextRequest) {
  try {
    const prices = await fetchAllPrices();
    
    priceCache = {
      data: prices,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      ...prices,
      cached: false,
      message: 'Cache refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing prices:', error);
    return NextResponse.json(
      { error: 'Failed to refresh prices' },
      { status: 500 }
    );
  }
}
