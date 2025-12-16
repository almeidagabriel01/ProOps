import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPriceIdForAddon, BillingInterval } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, tenantId, addonType, userEmail, billingInterval = 'monthly' } = body;

    if (!userId || !tenantId || !addonType) {
      return NextResponse.json(
        { error: 'userId, tenantId and addonType are required' },
        { status: 400 }
      );
    }

    // Validate billing interval
    const validInterval: BillingInterval = billingInterval === 'yearly' ? 'yearly' : 'monthly';

    // Get the price ID for the selected add-on and interval
    const priceId = getPriceIdForAddon(addonType, validInterval);
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid add-on type or price not configured' },
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

    // Create customer if doesn't exist
    if (!customerId && userEmail) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId: userId,
          tenantId: tenantId,
        },
      });
      customerId = customer.id;
      
      // Save customer ID to user
      await updateDoc(userRef, {
        stripeCustomerId: customerId,
      });
    }

    // Create checkout session for add-on subscription
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
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/addon-success?session_id={CHECKOUT_SESSION_ID}&addon=${addonType}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile/addons?canceled=true`,
      metadata: {
        userId: userId,
        tenantId: tenantId,
        addonType: addonType,
        billingInterval: validInterval,
        type: 'addon', // Mark as add-on purchase for webhook
      },
      subscription_data: {
        metadata: {
          userId: userId,
          tenantId: tenantId,
          addonType: addonType,
          billingInterval: validInterval,
          type: 'addon',
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating addon checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
