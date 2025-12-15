import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPriceIdForTier } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

async function getPlanIdByTier(tier: string): Promise<string | null> {
  const plansRef = collection(db, 'plans');
  const q = query(plansRef, where('tier', '==', tier));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, planTier } = body;

    if (!userId || !planTier) {
      return NextResponse.json(
        { error: 'userId and planTier are required' },
        { status: 400 }
      );
    }

    // Get the price ID for the selected plan
    const priceId = getPriceIdForTier(planTier);
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid plan tier or price not configured' },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Get user's current subscription
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userSnap.data();
    const subscriptionId = userData.stripeSubscriptionId;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0]?.id;

    if (!subscriptionItemId) {
      return NextResponse.json(
        { error: 'Subscription item not found' },
        { status: 400 }
      );
    }

    // Update subscription to new price (downgrade or upgrade)
    await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscriptionItemId,
          price: priceId,
        },
      ],
      proration_behavior: 'create_prorations', // Pro-rate the difference
      metadata: {
        userId: userId,
        planTier: planTier,
      },
    });

    // Update user's plan in Firestore
    const planId = await getPlanIdByTier(planTier);
    if (planId) {
      await updateDoc(userRef, {
        planId: planId,
        planUpdatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, message: 'Subscription updated successfully' });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
