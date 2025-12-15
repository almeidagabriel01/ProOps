import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { DEFAULT_PLANS } from '@/services/plan-service';

import { fetchPlansFromStripe } from '@/lib/stripe-sync';

async function getPlanIdByTier(tier: string): Promise<string | null> {
  const plansRef = collection(db, 'plans');
  const q = query(plansRef, where('tier', '==', tier));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  // If plan not found in Firestore, try to find in defaults and create it
  // BUT use Stripe prices if available to ensure consistency
  const defaultPlan = DEFAULT_PLANS.find(p => p.tier === tier);
  
  if (defaultPlan) {
    try {
      // Try to fetch fresh data from Stripe to get correct pricing
      const stripePlans = await fetchPlansFromStripe();
      const stripePlan = stripePlans.find(p => p.tier === tier);
      
      const planToSeed = {
        ...defaultPlan,
        ...(stripePlan ? {
            price: stripePlan.price,
            pricing: stripePlan.pricing
        } : {})
      };

      const docRef = await addDoc(plansRef, planToSeed);
      console.log(`Seeded missing plan: ${tier} (${docRef.id}) with price ${planToSeed.price}`);
      return docRef.id;
    } catch (error) {
      console.error(`Error seeding plan ${tier}:`, error);
      return null;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    const userId = session.metadata?.userId;
    const planTier = session.metadata?.planTier;
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription?.id;

    if (!userId || !planTier) {
      return NextResponse.json(
        { error: 'Missing metadata in session' },
        { status: 400 }
      );
    }

    // Get plan ID
    const planId = await getPlanIdByTier(planTier);
    
    if (!planId) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Determine billing interval from session metadata or subscription
    let billingInterval = session.metadata?.billingInterval;
    
    // Fallback: try to determine from subscription items if not in metadata
    if (!billingInterval && session.subscription && typeof session.subscription !== 'string') {
       const price = session.subscription.items.data[0]?.price;
       if (price?.recurring?.interval === 'year') {
         billingInterval = 'yearly';
       } else {
         billingInterval = 'monthly';
       }
    }

    // Update user in Firestore
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      planId: planId,
      stripeSubscriptionId: subscriptionId || null,
      planUpdatedAt: new Date().toISOString(),
      role: 'admin', // Upgrade from free to admin
      billingInterval: billingInterval || 'monthly', // Save the interval!
    });

    console.log(`Confirmed checkout for user ${userId}, upgraded to ${planTier} (${planId})`);

    return NextResponse.json({ 
      success: true,
      planId: planId,
      planTier: planTier,
    });
  } catch (error) {
    console.error('Error confirming checkout:', error);
    return NextResponse.json(
      { error: 'Failed to confirm checkout' },
      { status: 500 }
    );
  }
}
