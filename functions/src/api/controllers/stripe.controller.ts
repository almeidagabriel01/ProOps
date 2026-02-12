import { Request, Response } from "express";
import {
  getStripe,
  getPriceIdForTier,
  getPriceConfig,
  BillingInterval,
  getPriceIdForAddon,
  getAppUrl,
} from "../../stripe/stripeConfig";
import { updateSubscriptionStatus } from "../../stripe/stripeHelpers";

import { db } from "../../init";

type StripeSyncStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "INACTIVE";

function mapStripeSubscriptionStatus(status: string): StripeSyncStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    default:
      return "INACTIVE";
  }
}

async function hasSuperAdminRole(req: Request): Promise<boolean> {
  const claimRole = String(req.user?.role || "").toLowerCase();
  if (claimRole === "superadmin") return true;

  const userId = req.user?.uid;
  if (!userId) return false;

  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) return false;

  const userRole = String(userSnap.data()?.role || "").toLowerCase();
  return userRole === "superadmin";
}

function resolveRequestOrigin(req: Request): string {
  const requestOrigin = req.headers.origin;

  if (typeof requestOrigin === "string" && requestOrigin.trim()) {
    return requestOrigin.replace(/\/+$/, "");
  }

  return getAppUrl().replace(/\/+$/, "");
}

// Handlers adapted from original onCall functions

export const cancelAddon = async (req: Request, res: Response) => {
  try {
    const { addonId, tenantId: bodyTenantId } = req.body;
    const userId = (req as any).user!.uid;

    if (!addonId) {
      return res.status(400).json({ message: "Addon ID is required" });
    }

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    let tenantId = bodyTenantId;
    if (!tenantId && userSnap.exists) {
      tenantId = userSnap.data()?.tenantId;
    }

    if (!tenantId) {
      tenantId = `tenant_${userId}`;
    }

    // Look up the addon purchase
    const dbAddonId = `${tenantId}_${addonId}`;
    const addonRef = db.collection("addons").doc(dbAddonId);
    const addonSnap = await addonRef.get();

    if (!addonSnap.exists) {
      return res.status(404).json({ message: "Addon subscription not found" });
    }

    const addonData = addonSnap.data();
    const stripeSubscriptionId = addonData?.stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return res
        .status(400)
        .json({ message: "No active Stripe subscription for this addon" });
    }

    // Schedule cancellation at period end (NOT immediate cancellation)
    // This allows the user to keep the addon until the renewal date
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      },
    );

    // Update addon in Firestore to reflect pending cancellation
    // The addon stays active until the period ends
    await addonRef.update({
      cancelAtPeriodEnd: true,
      cancelScheduledAt: new Date().toISOString(),
      currentPeriodEnd: new Date(
        subscription.current_period_end * 1000,
      ).toISOString(),
    });

    return res.json({
      success: true,
      message: "Add-on will be cancelled at the end of the billing period",
      cancelAt: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  } catch (error: unknown) {
    console.error("Cancel Addon Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.uid;
    console.log(`[cancelSubscription] Starting for userId: ${userId}`);

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.log(`[cancelSubscription] User not found: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userSnap.data();
    // Check both possible locations for subscription ID
    const stripeSubscriptionId =
      userData?.stripeSubscriptionId || userData?.subscription?.id;

    console.log(`[cancelSubscription] User data:`, {
      stripeSubscriptionId,
      subscriptionFromNested: userData?.subscription?.id,
      hasSubscriptionObject: !!userData?.subscription,
    });

    if (!stripeSubscriptionId) {
      console.log(
        `[cancelSubscription] No subscription ID found for user: ${userId}`,
      );
      return res.status(400).json({ message: "No active subscription found" });
    }

    // Schedule cancellation at period end (NOT immediate cancellation)
    const stripe = getStripe();
    console.log(
      `[cancelSubscription] Updating Stripe subscription: ${stripeSubscriptionId}`,
    );

    const subscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      },
    );

    console.log(
      `[cancelSubscription] Stripe updated successfully, cancel_at_period_end: ${subscription.cancel_at_period_end}`,
    );

    // Update user document with cancellation info
    const currentPeriodEnd = new Date(
      subscription.current_period_end * 1000,
    ).toISOString();

    await userRef.update({
      cancelAtPeriodEnd: true,
      cancelScheduledAt: new Date().toISOString(),
      currentPeriodEnd: currentPeriodEnd,
    });

    console.log(`[cancelSubscription] Firestore updated for user: ${userId}`);

    return res.json({
      success: true,
      message:
        "Subscription will be cancelled at the end of the billing period",
      cancelAt: currentPeriodEnd,
    });
  } catch (error: unknown) {
    console.error("[cancelSubscription] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message, success: false });
  }
};

export const createAddonCheckoutSession = async (
  req: Request,
  res: Response,
) => {
  try {
    const { addonId, userEmail, tenantId: bodyTenantId } = req.body;
    const userId = (req as any).user!.uid;

    if (!addonId) {
      return res.status(400).json({ message: "Addon ID is required" });
    }

    const priceId = getPriceIdForAddon(addonId);

    if (!priceId) {
      return res
        .status(400)
        .json({ message: "Invalid addon or price not configured" });
    }

    const stripe = getStripe();
    let customerId = (req as any).user!.stripeId;
    const userRef = db.collection("users").doc(userId);

    // Only fetch if missing or if we need tenantId
    let userSnap: FirebaseFirestore.DocumentSnapshot | undefined;

    // Always fetch user data to get tenantId if not provided
    userSnap = await userRef.get();

    let tenantId = bodyTenantId;
    if (userSnap && userSnap.exists) {
      customerId = userSnap.data()?.stripeId;
      if (!tenantId) {
        tenantId = userSnap.data()?.tenantId;
      }
    }

    // Fallback if tenantId is still missing
    if (!tenantId) {
      tenantId = `tenant_${userId}`;
    }

    if (!userSnap.exists) {
      // Create basic user doc if missing
      const newUserData = {
        email: userEmail || "",
        role: "free",
        createdAt: new Date().toISOString(),
        tenantId: tenantId,
      };
      await userRef.set(newUserData);
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

    const appOrigin = resolveRequestOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appOrigin}/profile/addons?success=true`,
      cancel_url: `${appOrigin}/profile/addons?canceled=true`,
      metadata: { userId, addonType: addonId, tenantId, type: "addon" },
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe Addon Checkout Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { planTier, userEmail, billingInterval = "monthly" } = req.body;
    const userId = (req as any).user!.uid;

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
    let customerId = (req as any).user!.stripeId;
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

    const appOrigin = resolveRequestOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appOrigin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/subscribe`,
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
    const userId = (req as any).user!.uid;
    const userSnap = await db.collection("users").doc(userId).get();
    let stripeId = userSnap.data()?.stripeId;
    const userData = userSnap.data();

    const stripe = getStripe();

    // If Stripe ID is missing, create a new customer
    if (!stripeId) {
      console.log(
        `[createPortalSession] Missing stripeId for user ${userId}. Creating new customer...`,
      );
      const email = userData?.email;

      if (!email) {
        return res
          .status(400)
          .json({ message: "User email required to create Stripe customer" });
      }

      const customer = await stripe.customers.create({
        email: email,
        metadata: { firebaseUID: userId },
      });

      stripeId = customer.id;

      // Save for future use
      await db.collection("users").doc(userId).update({ stripeId });
    }

    const appOrigin = resolveRequestOrigin(req);

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeId,
      return_url: `${appOrigin}/profile`,
    });

    return res.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Portal Session Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
};

export const getPlans = async (_req: Request, res: Response) => {
  try {
    const stripe = getStripe();
    const priceConfig = getPriceConfig();
    console.log("Fetching plans and addons prices");

    // Plan metadata (features, descriptions, etc.)
    const planMetadata: Record<
      string,
      {
        name: string;
        description: string;
        order: number;
        highlighted?: boolean;
        features: Record<string, number | boolean>;
      }
    > = {
      starter: {
        name: "Starter",
        description: "Ideal para freelancers e pequenos negócios",
        order: 1,
        features: {
          maxProposals: 80,
          maxClients: 120,
          maxProducts: 220,
          maxUsers: 2,
          hasFinancial: false,
          canCustomizeTheme: false,
          maxPdfTemplates: 1,
          canEditPdfSections: false,
          maxImagesPerProduct: 2,
          maxStorageMB: 200,
        },
      },
      pro: {
        name: "Profissional",
        description: "Para empresas em crescimento",
        order: 2,
        highlighted: true,
        features: {
          maxProposals: -1,
          maxClients: -1,
          maxProducts: -1,
          maxUsers: 10,
          hasFinancial: true,
          canCustomizeTheme: true,
          maxPdfTemplates: 3,
          canEditPdfSections: false,
          maxImagesPerProduct: 3,
          maxStorageMB: 2560,
        },
      },
      enterprise: {
        name: "Enterprise",
        description: "Acesso total para grandes operações",
        order: 3,
        features: {
          maxProposals: -1,
          maxClients: -1,
          maxProducts: -1,
          maxUsers: -1,
          hasFinancial: true,
          canCustomizeTheme: true,
          maxPdfTemplates: -1,
          canEditPdfSections: true,
          maxImagesPerProduct: 3,
          maxStorageMB: -1,
        },
      },
    };

    // Collect all price IDs to fetch from Stripe
    const priceIds: string[] = [];

    // Plans
    for (const tier of Object.keys(priceConfig.plans)) {
      const tierConfig = priceConfig.plans[tier];
      if (tierConfig.monthly) priceIds.push(tierConfig.monthly);
      if (tierConfig.yearly) priceIds.push(tierConfig.yearly);
    }

    // Addons
    for (const addonType of Object.keys(priceConfig.addons)) {
      const addonConfig = priceConfig.addons[addonType];
      if (addonConfig.monthly) priceIds.push(addonConfig.monthly);
    }

    // Fetch all prices from Stripe in parallel
    const pricePromises = priceIds
      .filter((id) => id)
      .map((id) => stripe.prices.retrieve(id).catch(() => null));
    const stripePrices = await Promise.all(pricePromises);

    // Build price map: priceId -> { amount, interval }
    const priceMap: Record<string, { amount: number; interval: string }> = {};
    for (const price of stripePrices) {
      if (price && price.unit_amount !== null) {
        priceMap[price.id] = {
          amount: price.unit_amount / 100, // Convert from cents to BRL
          interval: price.recurring?.interval || "month",
        };
      }
    }

    // Build plans response with real Stripe prices
    const plans = Object.entries(priceConfig.plans).map(
      ([tier, tierPrices]) => {
        const prices = tierPrices as { monthly: string; yearly: string };
        const monthlyPriceId = prices.monthly;
        const yearlyPriceId = prices.yearly;

        const monthlyAmount = priceMap[monthlyPriceId]?.amount || 0;
        const yearlyAmount = priceMap[yearlyPriceId]?.amount || 0;

        const metadata = planMetadata[tier] || {
          name: tier,
          description: "",
          order: 99,
          features: {},
        };

        return {
          id: tier,
          tier,
          name: metadata.name,
          description: metadata.description,
          price: monthlyAmount, // Default to monthly price
          pricing: {
            monthly: monthlyAmount,
            yearly: yearlyAmount,
          },
          order: metadata.order,
          highlighted: metadata.highlighted || false,
          features: metadata.features,
        };
      },
    );

    // Build addons response
    const addons: Record<string, { monthly: { amount: number } }> = {};
    for (const [addonType, config] of Object.entries(priceConfig.addons)) {
      const monthlyId = config.monthly;
      const amount = priceMap[monthlyId]?.amount || 0;
      addons[addonType] = {
        monthly: { amount },
      };
    }

    // Sort by order
    plans.sort((a, b) => a.order - b.order);

    return res.json({ success: true, plans, addons });
  } catch (error) {
    console.error("Error fetching plans from Stripe:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching plans",
      plans: [],
    });
  }
};

export const syncSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user!.uid;
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    if (!userData) {
      return res.status(404).json({ message: "User not found" });
    }

    // Try to find subscription ID from various fields
    const stripeSubscriptionId =
      userData.stripeSubscriptionId || userData.subscription?.id;

    if (!stripeSubscriptionId) {
      return res.status(400).json({ message: "No active subscription found" });
    }

    const stripe = getStripe();
    let subscription;

    try {
      subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    } catch (e) {
      console.error("Stripe retrieve error:", e);
      return res
        .status(400)
        .json({ message: "Subscription not found in Stripe" });
    }

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const status = mapStripeSubscriptionStatus(subscription.status);

    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    await updateSubscriptionStatus(
      userId,
      status,
      "Manual Sync",
      currentPeriodEnd,
      subscription.cancel_at_period_end,
    );

    return res.json({
      success: true,
      data: {
        status,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error("Sync Subscription Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
};

export const syncAllSubscriptions = async (req: Request, res: Response) => {
  try {
    if (!(await hasSuperAdminRole(req))) {
      return res.status(403).json({ message: "Only superadmin can run batch sync" });
    }

    const body = (req.body || {}) as {
      dryRun?: boolean;
      limit?: number;
      startAfterId?: string;
    };

    const dryRun = body.dryRun !== false;
    const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 500);
    const startAfterId =
      typeof body.startAfterId === "string" && body.startAfterId.trim().length > 0
        ? body.startAfterId.trim()
        : undefined;

    let usersQuery: FirebaseFirestore.Query = db
      .collection("users")
      .orderBy("__name__")
      .limit(limit);

    if (startAfterId) {
      const cursorDoc = await db.collection("users").doc(startAfterId).get();
      if (!cursorDoc.exists) {
        return res.status(400).json({ message: "startAfterId user not found" });
      }
      usersQuery = usersQuery.startAfter(cursorDoc);
    }

    const usersSnapshot = await usersQuery.get();
    const stripe = getStripe();

    let scanned = 0;
    let eligible = 0;
    let synced = 0;
    let failed = 0;

    const errors: Array<{ userId: string; error: string }> = [];

    for (const userDoc of usersSnapshot.docs) {
      scanned += 1;
      const userData = userDoc.data();
      const stripeSubscriptionId =
        userData?.stripeSubscriptionId || userData?.subscription?.id;

      if (!stripeSubscriptionId || typeof stripeSubscriptionId !== "string") {
        continue;
      }

      eligible += 1;

      try {
        const subscription = await stripe.subscriptions.retrieve(
          stripeSubscriptionId
        );

        const status = mapStripeSubscriptionStatus(subscription.status);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

        if (!dryRun) {
          await updateSubscriptionStatus(
            userDoc.id,
            status,
            "Batch sync",
            currentPeriodEnd,
            subscription.cancel_at_period_end,
          );
        }

        synced += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push({ userId: userDoc.id, error: message });
      }
    }

    const lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];

    return res.json({
      success: true,
      dryRun,
      scanned,
      eligible,
      synced,
      failed,
      nextStartAfterId: usersSnapshot.empty ? null : lastDoc.id,
      hasMore: usersSnapshot.size === limit,
      errors,
    });
  } catch (error) {
    console.error("Batch sync subscriptions error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ message });
  }
};
