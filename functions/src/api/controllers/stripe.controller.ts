import { Request, Response } from "express";
import {
  getStripe,
  getPriceIdForTier,
  BillingInterval,
} from "../../stripe/stripeConfig";
import { db } from "../../init";

// Handlers adapted from original onCall functions

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { planTier, userEmail, billingInterval = "monthly" } = req.body;
    const userId = req.user!.uid;

    if (!planTier) {
      return res.status(400).json({ message: "Plan tier is required" });
    }

    const validInterval: BillingInterval =
      billingInterval === "yearly" ? "yearly" : "monthly";
    const priceId = getPriceIdForTier(planTier, validInterval);

    if (!priceId) {
      return res
        .status(400)
        .json({ message: "Invalid plan tier or price not configured" });
    }

    const stripe = getStripe();
    let customerId = req.user!.stripeId;
    const userRef = db.collection("users").doc(userId);

    // Only fetch if missing
    let userSnap: FirebaseFirestore.DocumentSnapshot | undefined;
    if (!customerId) {
      userSnap = await userRef.get();
    }

    // let customerId: string | undefined; // Removed

    if (userSnap && !userSnap.exists) {
      // Create basic user doc if missing
      const newUserData = {
        email: userEmail || "",
        role: "free",
        createdAt: new Date().toISOString(),
        tenantId: `tenant_${userId}`,
      };
      await userRef.set(newUserData);
    } else if (userSnap) {
      customerId = userSnap.data()?.stripeId;
      // If user has subscription, logic to handle upgrade/downgrade should be here
      // For now, following the simple checkout flow
    }

    if (!customerId) {
      // Create stripe customer if not exists
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { firebaseUID: userId },
      });
      customerId = customer.id;
      await userRef.update({ stripeId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.origin || "https://app-url.com"}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || "https://app-url.com"}/subscribe`,
      metadata: { userId, planTier, billingInterval: validInterval },
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe Checkout Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
};

export const createPortalSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const userSnap = await db.collection("users").doc(userId).get();
    const stripeId = userSnap.data()?.stripeId;

    if (!stripeId) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeId,
      return_url: `${req.headers.origin || "https://app-url.com"}/profile`,
    });

    return res.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
};

export const getPlans = async (req: Request, res: Response) => {
  // Return plans config
  // This could also be just static data or fetched from Stripe
  // For now, returning success
  return res.json({ success: true, plans: [] });
};
