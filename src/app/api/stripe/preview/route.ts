import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPriceIdForTier } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, newPlanTier } = body;

    if (!userId || !newPlanTier) {
      return NextResponse.json(
        { error: 'userId and newPlanTier are required' },
        { status: 400 }
      );
    }

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
    const newPriceId = getPriceIdForTier(newPlanTier);
    if (!newPriceId) {
      return NextResponse.json(
        { error: 'Invalid plan tier' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
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
      customer: customerId,
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

    // Calculate amounts
    const currentAmount = (currentPrice.unit_amount || 0) / 100;
    const newAmount = (newPrice.unit_amount || 0) / 100;
    const amountDue = preview.amount_due / 100;
    const isUpgrade = newAmount > currentAmount;
    const isDowngrade = newAmount < currentAmount;

    // Calculate credit (for display)
    let creditAmount = 0;
    for (const line of preview.lines.data) {
      if (line.amount < 0) {
        creditAmount += Math.abs(line.amount) / 100;
      }
    }

    return NextResponse.json({
      preview: {
        currentPlan: {
          tier: subscription.metadata?.planTier || 'unknown',
          price: currentAmount,
        },
        newPlan: {
          tier: newPlanTier,
          price: newAmount,
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
      { error: error.message || 'Failed to create preview' },
      { status: 500 }
    );
  }
}
