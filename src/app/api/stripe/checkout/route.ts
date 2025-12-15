import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPriceIdForTier, BillingInterval } from '@/lib/stripe';
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
    const { userId, planTier, userEmail, billingInterval = 'monthly' } = body;

    if (!userId || !planTier) {
      return NextResponse.json(
        { error: 'userId and planTier are required' },
        { status: 400 }
      );
    }

    // Validate billing interval
    const validInterval: BillingInterval = billingInterval === 'yearly' ? 'yearly' : 'monthly';

    // Get the price ID for the selected plan and interval
    const priceId = getPriceIdForTier(planTier, validInterval);
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid plan tier or price not configured' },
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
    let customerId = userData.stripeCustomerId;
    const existingSubscriptionId = userData.stripeSubscriptionId;

    // If user has existing subscription, update it with proration
    if (existingSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(existingSubscriptionId);
        
        // If subscription is active, update it with proration
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          const subscriptionItemId = subscription.items.data[0]?.id;
          
          if (subscriptionItemId) {
            // Update subscription with immediate billing
            await stripe.subscriptions.update(existingSubscriptionId, {
              items: [
                {
                  id: subscriptionItemId,
                  price: priceId,
                },
              ],
              proration_behavior: 'always_invoice',
              billing_cycle_anchor: 'now', // Reset billing cycle to now
              payment_behavior: 'error_if_incomplete', // Fail if payment fails
              metadata: {
                userId: userId,
                planTier: planTier,
                billingInterval: validInterval,
              },
            });

            // Update user's plan in Firestore
            const planId = await getPlanIdByTier(planTier);
            if (planId) {
              await updateDoc(userRef, {
                planId: planId,
                billingInterval: validInterval,
                planUpdatedAt: new Date().toISOString(),
              });
            }

            return NextResponse.json({ 
              success: true, 
              message: 'Subscription updated successfully' 
            });
          }
        }
      } catch (subError: any) {
        console.log('Error updating subscription:', subError?.message || subError);
        // If update fails, proceed to create new checkout
      }
    }

    // Create customer if doesn't exist
    if (!customerId && userEmail) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;
      
      // Save customer ID to user
      await updateDoc(userRef, {
        stripeCustomerId: customerId,
      });
    }

    // Create checkout session for new subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/?canceled=true`,
      metadata: {
        userId: userId,
        planTier: planTier,
        billingInterval: validInterval,
      },
      subscription_data: {
        metadata: {
          userId: userId,
          planTier: planTier,
          billingInterval: validInterval,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}


