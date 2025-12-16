import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { AddonType } from '@/types';

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

    const metadata = session.metadata || {};
    
    // Verify this is an add-on checkout
    if (metadata.type !== 'addon') {
      return NextResponse.json(
        { error: 'This session is not an add-on purchase' },
        { status: 400 }
      );
    }

    const tenantId = metadata.tenantId;
    const addonType = metadata.addonType as AddonType;
    const billingInterval = metadata.billingInterval as 'monthly' | 'yearly' || 'monthly';
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription?.id;

    if (!tenantId || !addonType) {
      return NextResponse.json(
        { error: 'Missing add-on metadata in session' },
        { status: 400 }
      );
    }

    // Save add-on to Firestore
    const addonId = `${tenantId}_${addonType}`;
    await setDoc(doc(db, 'addons', addonId), {
      tenantId,
      addonType,
      stripeSubscriptionId: subscriptionId || null,
      billingInterval,
      status: 'active',
      purchasedAt: new Date().toISOString(),
    });

    console.log(`Confirmed add-on checkout: ${addonType} for tenant ${tenantId}`);

    return NextResponse.json({ 
      success: true,
      addonId: addonId,
      addonType: addonType,
      tenantId: tenantId,
    });
  } catch (error) {
    console.error('Error confirming addon checkout:', error);
    return NextResponse.json(
      { error: 'Failed to confirm addon checkout' },
      { status: 500 }
    );
  }
}
