import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Stripe from 'stripe';

// Disable body parsing, we need the raw body for webhook verification
export const runtime = 'nodejs';

async function getPlanIdByTier(tier: string): Promise<string | null> {
  const plansRef = collection(db, 'plans');
  const q = query(plansRef, where('tier', '==', tier));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  return null;
}

async function updateUserPlan(userId: string, planTier: string, stripeSubscriptionId: string, interval?: string) {
  const planId = await getPlanIdByTier(planTier);
  
  // Map Stripe interval to our type
  const billingInterval = interval === 'year' ? 'yearly' : 'monthly';
  
  if (planId) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      planId: planId,
      billingInterval: billingInterval,
      stripeSubscriptionId: stripeSubscriptionId,
      planUpdatedAt: new Date().toISOString(),
      // Update role from 'free' to 'admin' when user subscribes
      role: 'admin',
    });
    console.log(`Updated user ${userId} to plan ${planTier} (${planId}) - ${billingInterval} with role admin`);
  } else {
    console.error(`Plan not found for tier: ${planTier}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planTier = session.metadata?.planTier;
  const subscriptionId = session.subscription as string;
  const billingInterval = session.metadata?.billingInterval; // passed in checkout

  if (userId && planTier && subscriptionId) {
    await updateUserPlan(userId, planTier, subscriptionId, billingInterval === 'yearly' ? 'year' : 'month');
  } else {
    console.error('Missing metadata in checkout session:', { userId, planTier, subscriptionId });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const planTier = subscription.metadata?.planTier;
  const interval = subscription.items.data[0]?.price.recurring?.interval;

  if (userId && planTier) {
    await updateUserPlan(userId, planTier, subscription.id, interval);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (userId) {
    // Downgrade to starter plan when subscription is canceled
    const starterPlanId = await getPlanIdByTier('starter');
    
    if (starterPlanId) {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        planId: starterPlanId,
        stripeSubscriptionId: null,
        planUpdatedAt: new Date().toISOString(),
      });
      console.log(`User ${userId} subscription canceled, downgraded to starter`);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;

    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
