import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPriceIdForTier } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, newPlanTier, billingInterval } = body;

    if (!userId || !newPlanTier) {
      return NextResponse.json(
        { error: 'userId and newPlanTier are required' },
        { status: 400 }
      );
    }
    
    // Default to monthly if not specified, ensuring valid type
    const targetInterval: 'monthly' | 'yearly' = billingInterval === 'yearly' ? 'yearly' : 'monthly';

    const stripe = getStripe();

    // Get user data
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userSnap.data();
    const customerId = userData.stripeCustomerId;
    const subscriptionId = userData.stripeSubscriptionId;

    if (!customerId || !subscriptionId) {
      return NextResponse.json({
        preview: null,
        message: 'No active subscription found',
        isNewSubscription: true,
      });
    }

    // Get new price ID
    const newPriceId = getPriceIdForTier(newPlanTier, targetInterval);
    if (!newPriceId) {
      return NextResponse.json(
        { error: 'Invalid plan tier or interval' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Use the customer ID from the subscription to ensure match
    // This fixes "subscription does not belong to customer" errors if DB is out of sync
    const activeCustomerId = typeof subscription.customer === 'string' 
      ? subscription.customer 
      : subscription.customer.id;

    const subscriptionItemId = subscription.items.data[0]?.id;
    const currentPriceId = subscription.items.data[0]?.price?.id;

    if (!subscriptionItemId) {
      return NextResponse.json(
        { error: 'Subscription item not found' },
        { status: 400 }
      );
    }

    // Get proration preview using upcoming invoice
    const preview = await stripe.invoices.createPreview({
      customer: activeCustomerId,
      subscription: subscriptionId,
      subscription_details: {
        items: [
          {
            id: subscriptionItemId,
            price: newPriceId,
          },
        ],
        proration_behavior: 'always_invoice',
        billing_cycle_anchor: 'now',
      },
    });

    // Get current and new prices
    const [currentPrice, newPrice] = await Promise.all([
      stripe.prices.retrieve(currentPriceId!),
      stripe.prices.retrieve(newPriceId),
    ]);

    // Get default payment method
    let paymentMethod = null;
    if (subscription.default_payment_method) {
      const pm = await stripe.paymentMethods.retrieve(
        subscription.default_payment_method as string
      );
      if (pm.card) {
        paymentMethod = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        };
      }
    }

    // Calculate amounts from preview lines
    const currentAmount = (currentPrice.unit_amount || 0) / 100;
    const newAmount = (newPrice.unit_amount || 0) / 100;
    const isUpgrade = newAmount > currentAmount;
    const isDowngrade = newAmount < currentAmount;

    // Calculate credit and charge from preview lines
    let creditAmount = 0;
    let chargeAmount = 0;
    for (const line of preview.lines.data) {
      if (line.amount < 0) {
        creditAmount += Math.abs(line.amount) / 100;
      } else {
        chargeAmount += line.amount / 100;
      }
    }

    // The actual amount due from Stripe (this is what will be charged)
    const amountDue = preview.amount_due / 100;

    // Determine current plan tier from Firestore
    // planId is a document ID, we need to fetch the plan to get the tier
    let currentPlanTier = 'unknown';
    if (userData.planId) {
      const planRef = doc(db, 'plans', userData.planId);
      const planSnap = await getDoc(planRef);
      if (planSnap.exists()) {
        currentPlanTier = planSnap.data().tier || planSnap.data().name || 'unknown';
      }
    }
    // Fallback to Stripe metadata if not found
    if (currentPlanTier === 'unknown') {
      currentPlanTier = subscription.metadata?.planTier || 'unknown';
    }

    return NextResponse.json({
      preview: {
        currentPlan: {
          tier: currentPlanTier,
          price: currentAmount,
          interval: currentPrice.recurring?.interval === 'year' ? 'yearly' : 'monthly',
        },
        newPlan: {
          tier: newPlanTier,
          price: newAmount,
          interval: targetInterval,
        },
        amountDue,
        creditAmount,
        isUpgrade,
        isDowngrade,
        paymentMethod,
        nextBillingDate: new Date(preview.period_end * 1000).toLocaleDateString('pt-BR'),
      },
    });
  } catch (error: any) {
    console.error('Error creating preview:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create preview',
        details: error.type || 'Unknown error type' 
      },
      { status: 500 }
    );
  }
}
