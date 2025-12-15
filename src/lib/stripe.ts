import Stripe from 'stripe';

// Lazy initialization to avoid build errors
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2025-11-17.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

// Billing interval types
export type BillingInterval = 'monthly' | 'yearly';

// Price IDs mapping with intervals - configure these in .env.local
export const STRIPE_PRICE_IDS: Record<string, Record<BillingInterval, string>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || '',
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || '',
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '',
  },
};

// Get price ID for a plan tier and billing interval
export function getPriceIdForTier(tier: string, interval: BillingInterval = 'monthly'): string | null {
  return STRIPE_PRICE_IDS[tier]?.[interval] || null;
}

