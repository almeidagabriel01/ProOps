import { Request, Response } from "express";
import {
  getStripe,
  getPriceIdForTier,
  getPriceConfig,
  BillingInterval,
  getPriceIdForAddon,
  getAppUrl,
} from "../../stripe/stripeConfig";
import {
  updateSubscriptionStatus,
  updateUserPlan,
  mapStripeSubscriptionStatus,
  runStripeSync,
  addWhatsAppOverageToSubscription,
  upsertTenantStripeBillingData,
  WHATSAPP_OVERAGE_PRICE_ID,
} from "../../stripe/stripeHelpers";

import { db } from "../../init";
import {
  assertSuperAdminClaim,
  assertTenantAdminClaim,
  getTenantClaim,
} from "../../lib/request-auth";
import Stripe from "stripe";

// function mapStripeSubscriptionStatus removed (moved to helpers)

function normalizeOrigin(value: string): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const candidates = /^https?:\/\//i.test(raw)
    ? [raw]
    : [`https://${raw}`, `http://${raw}`];

  for (const candidate of candidates) {
    try {
      return new URL(candidate).origin;
    } catch {
      // try next candidate
    }
  }

  return null;
}

function addOriginWithVariants(target: Set<string>, value: string): void {
  const normalized = normalizeOrigin(value);
  if (!normalized) return;

  target.add(normalized);

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : "";

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return;
    }

    if (hostname.startsWith("www.")) {
      const bareHostname = hostname.slice(4);
      if (bareHostname) {
        target.add(`${parsed.protocol}//${bareHostname}${port}`);
      }
      return;
    }

    if (hostname.includes(".")) {
      target.add(`${parsed.protocol}//www.${hostname}${port}`);
    }
  } catch {
    // no-op
  }
}

function parseOrigins(rawValue: string | undefined): Set<string> {
  const origins = new Set<string>();
  if (!rawValue) return origins;

  rawValue
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      addOriginWithVariants(origins, entry);
    });

  return origins;
}

function resolveAllowedAppOrigins(): Set<string> {
  const origins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
  [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .forEach((entry) => {
      addOriginWithVariants(origins, entry);
    });

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

function isProductionRuntime(): boolean {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function allowCorsFallbackInCurrentEnvironment(): boolean {
  return (
    !isProductionRuntime() &&
    String(process.env.ALLOW_CORS_FALLBACK || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function allowsDynamicPreviewOrigins(): boolean {
  const defaultValue = isProductionRuntime() ? "false" : "true";
  return (
    String(process.env.CORS_ALLOW_DYNAMIC_PREVIEW_ORIGINS || defaultValue)
      .trim()
      .toLowerCase() !== "false"
  );
}

function isDynamicPreviewOrigin(origin: string): boolean {
  if (!allowsDynamicPreviewOrigins()) return false;

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname.endsWith(".vercel.app") ||
      hostname.endsWith(".web.app") ||
      hostname.endsWith(".firebaseapp.com")
    );
  } catch {
    return false;
  }
}

function resolveRequestOrigin(req: Request): string {
  const fallbackOrigin =
    normalizeOrigin(getAppUrl()) || getAppUrl().replace(/\/+$/, "");
  const allowedOrigins = resolveAllowedAppOrigins();
  const corsAllowlistMissing = allowedOrigins.size === 0;
  const corsFallbackEnabled = allowCorsFallbackInCurrentEnvironment();
  const requestOrigin =
    typeof req.headers.origin === "string"
      ? normalizeOrigin(req.headers.origin)
      : null;
  const bodyOrigin =
    typeof req.body?.origin === "string" ? normalizeOrigin(req.body.origin) : null;

  if (corsAllowlistMissing && isProductionRuntime()) {
    throw new Error("FORBIDDEN_CORS_ALLOWLIST_REQUIRED");
  }

  if (corsAllowlistMissing && corsFallbackEnabled) {
    return requestOrigin || bodyOrigin || fallbackOrigin;
  }

  if (
    requestOrigin &&
    (allowedOrigins.has(requestOrigin) || isDynamicPreviewOrigin(requestOrigin))
  ) {
    return requestOrigin;
  }
  if (bodyOrigin && (allowedOrigins.has(bodyOrigin) || isDynamicPreviewOrigin(bodyOrigin))) {
    return bodyOrigin;
  }

  if (!requestOrigin && !bodyOrigin) {
    return fallbackOrigin;
  }

  throw new Error("FORBIDDEN_CORS_ORIGIN");
}

function resolveAddonId(rawAddonId: unknown): string | null {
  const addonId = String(rawAddonId || "").trim();
  if (!addonId) return null;
  const purchaseableAddonIds = new Set([
    "financial",
    "pdf_editor_partial",
    "pdf_editor_full",
    "whatsapp_addon",
  ]);
  if (!purchaseableAddonIds.has(addonId)) return null;
  return getPriceIdForAddon(addonId) ? addonId : null;
}

function getPrimaryPlanSubscriptionItem(
  subscription: Stripe.Subscription,
): Stripe.SubscriptionItem | undefined {
  const nonOverageItem = subscription.items.data.find(
    (item) => item.price.id !== WHATSAPP_OVERAGE_PRICE_ID,
  );
  return nonOverageItem || subscription.items.data[0];
}

function hasRecurringMismatch(
  baseRecurring: Stripe.Price.Recurring | null,
  comparisonRecurring: Stripe.Price.Recurring | null,
): boolean {
  if (!baseRecurring || !comparisonRecurring) return false;
  return (
    baseRecurring.interval !== comparisonRecurring.interval ||
    (baseRecurring.interval_count || 1) !==
      (comparisonRecurring.interval_count || 1)
  );
}

function resolvePlanChangeBillingCycleAnchor(input: {
  currentRecurring: Stripe.Price.Recurring | null;
  targetRecurring: Stripe.Price.Recurring | null;
}): "unchanged" | "now" {
  if (hasRecurringMismatch(input.currentRecurring, input.targetRecurring)) {
    return "now";
  }
  return "unchanged";
}

function getStripeCustomerId(customer: string | Stripe.Customer | null): string {
  if (!customer) return "";
  return typeof customer === "string" ? customer : String(customer.id || "");
}

function isSafeEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return !!trimmed && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed);
}

function getErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHENTICATED") return 401;
  if (
    message.startsWith("FORBIDDEN_") ||
    message.startsWith("AUTH_CLAIMS_MISSING_")
  ) {
    return 403;
  }
  if (message === "NOT_FOUND") return 404;
  if (message === "BAD_REQUEST") return 400;
  return 500;
}

function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  const message = error.message;
  if (message === "UNAUTHENTICATED") return "Authentication required";
  if (message.startsWith("AUTH_CLAIMS_MISSING_")) {
    return "Missing required authorization claims";
  }
  if (message === "FORBIDDEN_CORS_ALLOWLIST_REQUIRED") {
    return "CORS origin allowlist is required in production";
  }
  if (message === "FORBIDDEN_CORS_ORIGIN") {
    return "Origin not allowed";
  }
  if (message.startsWith("FORBIDDEN_")) return "Forbidden";
  if (message === "NOT_FOUND") return "Resource not found";
  if (message === "BAD_REQUEST") return "Invalid request";
  return message;
}

function assertSubscriptionOwnership(
  subscription: Stripe.Subscription,
  tenantId: string,
  expectedCustomerId?: string,
): void {
  const subscriptionCustomerId = getStripeCustomerId(
    subscription.customer as string | Stripe.Customer | null,
  );
  if (
    expectedCustomerId &&
    subscriptionCustomerId &&
    subscriptionCustomerId !== expectedCustomerId
  ) {
    throw new Error("FORBIDDEN_STRIPE_OWNERSHIP");
  }

  const metadataTenantId = String(subscription.metadata?.tenantId || "").trim();
  if (metadataTenantId && metadataTenantId !== tenantId) {
    throw new Error("FORBIDDEN_STRIPE_OWNERSHIP");
  }
}

type ResolveStripeUserContextOptions = {
  allowFreeOwnerCheckout?: boolean;
};

async function resolveStripeUserContext(
  req: Request,
  options: ResolveStripeUserContextOptions = {},
): Promise<{
  userId: string;
  tenantId: string;
  customerId?: string;
  userRef: FirebaseFirestore.DocumentReference;
  userSnap: FirebaseFirestore.DocumentSnapshot;
  tenantRef: FirebaseFirestore.DocumentReference;
  tenantSnap: FirebaseFirestore.DocumentSnapshot;
}> {
  const role = String(req.user?.role || "")
    .trim()
    .toUpperCase();
  const hasMasterId = Boolean(String(req.user?.masterId || "").trim());
  const isFreeOwnerCheckout =
    options.allowFreeOwnerCheckout === true && role === "FREE" && !hasMasterId;

  if (!isFreeOwnerCheckout) {
    assertTenantAdminClaim(req);
  }

  const userId = req.user?.uid;
  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }

  const tenantId = getTenantClaim(req);
  if (!tenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();

  const userData = userSnap.exists
    ? (userSnap.data() as Record<string, unknown> | undefined)
    : undefined;
  const tenantData = tenantSnap.exists
    ? (tenantSnap.data() as Record<string, unknown> | undefined)
    : undefined;

  const docTenantId = String(userData?.tenantId || userData?.companyId || "").trim();

  if (docTenantId && docTenantId !== tenantId) {
    console.warn(
      `[Stripe] Tenant mismatch for user ${userId}. Rejecting request.`,
      {
        claimTenantId: tenantId,
        docTenantId,
      },
    );
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const tenantCustomerId = String(tenantData?.stripeCustomerId || "").trim();
  const userCustomerId =
    String(req.user?.stripeId || "").trim() ||
    String(userData?.stripeId || "").trim();
  const customerId = tenantCustomerId || userCustomerId || undefined;

  return {
    userId,
    tenantId,
    customerId,
    userRef,
    userSnap,
    tenantRef,
    tenantSnap,
  };
}

// Handlers adapted from original onCall functions

export const cancelAddon = async (req: Request, res: Response) => {
  try {
    const addonId = resolveAddonId(req.body?.addonId);
    if (!addonId) {
      return res.status(400).json({ message: "Valid addon ID is required" });
    }

    const { tenantId, customerId } = await resolveStripeUserContext(req);

    // Look up the addon purchase
    const dbAddonId = `${tenantId}_${addonId}`;
    const addonRef = db.collection("addons").doc(dbAddonId);
    const addonSnap = await addonRef.get();

    if (!addonSnap.exists) {
      return res.status(404).json({ message: "Addon subscription not found" });
    }

    const addonData = addonSnap.data();
    if (addonData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Addon does not belong to user tenant" });
    }

    const stripeSubscriptionId = addonData?.stripeSubscriptionId;

    if (!stripeSubscriptionId) {
      return res
        .status(400)
        .json({ message: "No active Stripe subscription for this addon" });
    }

    // Schedule cancellation at period end (NOT immediate cancellation)
    // This allows the user to keep the addon until the renewal date
    const stripe = getStripe();
    const existingSubscription = await stripe.subscriptions.retrieve(
      stripeSubscriptionId,
    );
    assertSubscriptionOwnership(existingSubscription, tenantId, customerId);

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
        (subscription as any).current_period_end * 1000,
      ).toISOString(),
    });

    return res.json({
      success: true,
      message: "Add-on will be cancelled at the end of the billing period",
      cancelAt: new Date(
        (subscription as any).current_period_end * 1000,
      ).toISOString(),
    });
  } catch (error: unknown) {
    console.error("Cancel Addon Error:", error);
    return res.status(getErrorStatus(error)).json({ message: getErrorMessage(error) });
  }
};

export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      tenantId,
      customerId,
      tenantRef,
      tenantSnap,
      userRef,
      userSnap,
    } = await resolveStripeUserContext(req);

    const tenantData = tenantSnap.exists
      ? (tenantSnap.data() as Record<string, unknown>)
      : {};
    const userData = userSnap.exists
      ? (userSnap.data() as Record<string, unknown>)
      : {};
    const legacySubscriptionId = String(
      (userData as { subscription?: { id?: string } })?.subscription?.id || "",
    ).trim();

    const stripeSubscriptionId = String(
      tenantData?.stripeSubscriptionId ||
        userData?.stripeSubscriptionId ||
        legacySubscriptionId ||
        "",
    ).trim();
    if (!stripeSubscriptionId) {
      return res.status(400).json({ message: "No active subscription found" });
    }

    const stripe = getStripe();
    const existingSubscription =
      await stripe.subscriptions.retrieve(stripeSubscriptionId);
    assertSubscriptionOwnership(existingSubscription, tenantId, customerId);

    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const currentPeriodEnd = new Date(
      (subscription as any).current_period_end * 1000,
    ).toISOString();
    const nowIso = new Date().toISOString();

    await Promise.all([
      tenantRef.set(
        {
          stripeSubscriptionId: subscription.id,
          cancelAtPeriodEnd: true,
          cancelScheduledAt: nowIso,
          currentPeriodEnd,
          updatedAt: nowIso,
        },
        { merge: true },
      ),
      userRef.set(
        {
          stripeSubscriptionId: subscription.id,
          cancelAtPeriodEnd: true,
          cancelScheduledAt: nowIso,
          currentPeriodEnd,
          updatedAt: nowIso,
        },
        { merge: true },
      ),
    ]);

    console.log(
      `[cancelSubscription] cancellation scheduled`,
      JSON.stringify({ userId, tenantId, subscriptionId: subscription.id }),
    );

    return res.json({
      success: true,
      message:
        "Subscription will be cancelled at the end of the billing period",
      cancelAt: currentPeriodEnd,
    });
  } catch (error: unknown) {
    console.error("[cancelSubscription] Error:", error);
    return res
      .status(getErrorStatus(error))
      .json({ message: getErrorMessage(error), success: false });
  }
};

export const createAddonCheckoutSession = async (
  req: Request,
  res: Response,
) => {
  try {
    const {
      userId,
      tenantId,
      userRef,
      userSnap,
      tenantRef,
      tenantSnap,
      customerId: contextCustomerId,
    } = await resolveStripeUserContext(req);
    const addonId = resolveAddonId(req.body?.addonId);
    if (typeof req.body?.userId === "string" && req.body.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const userEmail = isSafeEmail(req.body?.userEmail)
      ? req.body.userEmail.trim()
      : undefined;

    if (!addonId) {
      return res.status(400).json({ message: "Valid addon ID is required" });
    }

    const priceId = getPriceIdForAddon(addonId);

    if (!priceId) {
      return res
        .status(400)
        .json({ message: "Invalid addon or price not configured" });
    }

    const stripe = getStripe();
    let customerId = contextCustomerId;
    const userData = userSnap.exists
      ? (userSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const tenantData = tenantSnap.exists
      ? (tenantSnap.data() as Record<string, unknown> | undefined)
      : undefined;

    customerId =
      customerId ||
      String(userData?.stripeId || "").trim() ||
      String(tenantData?.stripeCustomerId || "").trim() ||
      undefined;

    if (!customerId) {
      // Create stripe customer if not exists
      const fallbackEmail = isSafeEmail(userData?.email)
        ? String(userData?.email).trim()
        : isSafeEmail(req.user?.email)
          ? String(req.user?.email).trim()
          : undefined;
      const customer = await stripe.customers.create({
        email: userEmail || fallbackEmail,
        metadata: { firebaseUID: userId, tenantId },
      });
      customerId = customer.id;
      const nowIso = new Date().toISOString();
      await Promise.all([
        userRef.set({ stripeId: customerId, updatedAt: nowIso }, { merge: true }),
        tenantRef.set(
          { stripeCustomerId: customerId, updatedAt: nowIso },
          { merge: true },
        ),
      ]);
    }

    const addonDocId = `${tenantId}_${addonId}`;
    const addonRef = db.collection("addons").doc(addonDocId);
    const existingAddonSnap = await addonRef.get();
    const existingAddonData = existingAddonSnap.exists
      ? (existingAddonSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const existingAddonSubscriptionId = String(
      existingAddonData?.stripeSubscriptionId || "",
    ).trim();

    if (existingAddonSubscriptionId) {
      try {
        const existingAddonSubscription = await stripe.subscriptions.retrieve(
          existingAddonSubscriptionId,
        );
        assertSubscriptionOwnership(
          existingAddonSubscription,
          tenantId,
          customerId,
        );

        if (
          ["active", "trialing", "past_due"].includes(
            String(existingAddonSubscription.status || ""),
          )
        ) {
          if (existingAddonSubscription.cancel_at_period_end) {
            const reactivatedSubscription = await stripe.subscriptions.update(
              existingAddonSubscription.id,
              { cancel_at_period_end: false },
            );
            await addonRef.set(
              {
                tenantId,
                addonType: addonId,
                stripeSubscriptionId: reactivatedSubscription.id,
                status:
                  reactivatedSubscription.status === "past_due"
                    ? "past_due"
                    : "active",
                cancelAtPeriodEnd: false,
                cancelScheduledAt: null,
                currentPeriodEnd: new Date(
                  (reactivatedSubscription as any).current_period_end * 1000,
                ).toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            );

            return res.json({
              success: true,
              message: "Add-on reactivated successfully",
            });
          }

          return res.json({
            success: true,
            message: "Add-on is already active",
          });
        }
      } catch (existingAddonError) {
        console.warn(
          "[createAddonCheckoutSession] Existing addon subscription check failed; creating new checkout session.",
          existingAddonError,
        );
      }
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
    return res.status(getErrorStatus(error)).json({ message: getErrorMessage(error) });
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      tenantId,
      userRef,
      userSnap,
      tenantRef,
      tenantSnap,
      customerId: contextCustomerId,
    } = await resolveStripeUserContext(req, { allowFreeOwnerCheckout: true });
    const planTier = String(req.body?.planTier || "").trim();
    const userEmail = req.body?.userEmail;
    const rawBillingInterval = String(req.body?.billingInterval || "monthly")
      .toLowerCase()
      .trim();
    if (typeof req.body?.userId === "string" && req.body.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!planTier) {
      return res.status(400).json({ message: "Plan tier is required" });
    }

    const validInterval: BillingInterval =
      rawBillingInterval === "yearly" ? "yearly" : "monthly";
    const priceId = getPriceIdForTier(planTier, validInterval);

    if (!priceId) {
      return res
        .status(400)
        .json({ message: "Invalid plan tier or price not configured" });
    }

    const stripe = getStripe();
    const targetPlanPrice = await stripe.prices.retrieve(priceId);
    const targetPlanRecurring = targetPlanPrice.recurring;
    const userData = userSnap.exists
      ? (userSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const tenantData = tenantSnap.exists
      ? (tenantSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const legacySubscriptionId = String(
      (userData as { subscription?: { id?: string } } | undefined)?.subscription
        ?.id || "",
    ).trim();
    const existingStripeSubscriptionId = String(
      tenantData?.stripeSubscriptionId ||
        userData?.stripeSubscriptionId ||
        legacySubscriptionId ||
        "",
    ).trim();

    let customerId =
      contextCustomerId ||
      String(userData?.stripeId || "").trim() ||
      String(tenantData?.stripeCustomerId || "").trim() ||
      undefined;

    if (existingStripeSubscriptionId) {
      const existingSubscription = await stripe.subscriptions.retrieve(
        existingStripeSubscriptionId,
      );
      assertSubscriptionOwnership(existingSubscription, tenantId, customerId);

      const currentPlanItem = getPrimaryPlanSubscriptionItem(existingSubscription);
      if (!currentPlanItem) {
        return res.status(400).json({
          message: "Could not resolve current plan subscription item",
        });
      }

      if (
        currentPlanItem.price.id === priceId &&
        !existingSubscription.cancel_at_period_end
      ) {
        return res.json({
          success: true,
          message: "Subscription already configured with requested plan",
        });
      }

      const billingCycleAnchor = resolvePlanChangeBillingCycleAnchor({
        currentRecurring: currentPlanItem.price.recurring,
        targetRecurring: targetPlanRecurring,
      });

      const updatedSubscription = await stripe.subscriptions.update(
        existingSubscription.id,
        {
          cancel_at_period_end: false,
          proration_behavior: "always_invoice",
          billing_cycle_anchor: billingCycleAnchor,
          items: existingSubscription.items.data.map((item) => {
            const shouldDeleteForMismatch =
              item.id !== currentPlanItem.id &&
              hasRecurringMismatch(targetPlanRecurring, item.price.recurring);

            if (shouldDeleteForMismatch) {
              return { id: item.id, deleted: true };
            }

            if (item.id === currentPlanItem.id) {
              return { id: item.id, price: priceId };
            }

            return { id: item.id };
          }),
          metadata: {
            ...existingSubscription.metadata,
            userId,
            tenantId,
            planTier,
            billingInterval: validInterval,
          },
        },
      );

      const overageItemId = await addWhatsAppOverageToSubscription(
        updatedSubscription.id,
      );
      const hydratedSubscription = overageItemId
        ? await stripe.subscriptions.retrieve(updatedSubscription.id)
        : updatedSubscription;

      const status = mapStripeSubscriptionStatus(hydratedSubscription.status);
      const currentPeriodEnd = new Date(
        (hydratedSubscription as any).current_period_end * 1000,
      );
      const effectiveCustomerId =
        getStripeCustomerId(
          hydratedSubscription.customer as string | Stripe.Customer | null,
        ) || customerId;

      const effectivePlanItem = getPrimaryPlanSubscriptionItem(hydratedSubscription);
      const interval = effectivePlanItem?.price?.recurring?.interval;
      const intervalForUserPlan = interval === "year" ? "year" : "month";

      await updateUserPlan(
        userId,
        planTier,
        hydratedSubscription.id,
        intervalForUserPlan,
        currentPeriodEnd,
        hydratedSubscription.cancel_at_period_end,
      );

      const whatsappItem = hydratedSubscription.items.data.find(
        (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
      );

      await upsertTenantStripeBillingData({
        tenantId,
        stripeCustomerId: effectiveCustomerId,
        stripeSubscriptionId: hydratedSubscription.id,
        whatsappOveragePriceId: WHATSAPP_OVERAGE_PRICE_ID,
        whatsappOverageSubscriptionItemId: whatsappItem?.id,
      });

      await Promise.all([
        tenantRef.set(
          {
            stripeCustomerId: effectiveCustomerId || null,
            stripeSubscriptionId: hydratedSubscription.id,
            subscriptionStatus: status.toLowerCase(),
            currentPeriodEnd: currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: hydratedSubscription.cancel_at_period_end,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ),
        userRef.set(
          {
            stripeId: effectiveCustomerId || null,
            stripeSubscriptionId: hydratedSubscription.id,
            subscriptionStatus: status.toLowerCase(),
            currentPeriodEnd: currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: hydratedSubscription.cancel_at_period_end,
            billingInterval: validInterval,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        ),
      ]);

      await updateSubscriptionStatus(
        userId,
        status,
        "Plan change with proration",
        currentPeriodEnd,
        hydratedSubscription.cancel_at_period_end,
      );

      return res.json({
        success: true,
        message: "Plan changed successfully with proration",
      });
    }

    if (!customerId) {
      // Create stripe customer if not exists
      const fallbackEmail = isSafeEmail(userEmail)
        ? userEmail.trim()
        : isSafeEmail(userData?.email)
          ? String(userData?.email).trim()
          : isSafeEmail(req.user?.email)
            ? String(req.user?.email).trim()
            : undefined;
      const customer = await stripe.customers.create({
        email: fallbackEmail,
        metadata: { firebaseUID: userId, tenantId },
      });
      customerId = customer.id;
      const nowIso = new Date().toISOString();
      await Promise.all([
        userRef.set({ stripeId: customerId, updatedAt: nowIso }, { merge: true }),
        tenantRef.set(
          { stripeCustomerId: customerId, updatedAt: nowIso },
          { merge: true },
        ),
      ]);
    }

    const appOrigin = resolveRequestOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appOrigin}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/subscribe`,
      metadata: { userId, tenantId, planTier, billingInterval: validInterval },
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Stripe Checkout Error:", error);
    return res.status(getErrorStatus(error)).json({ message: getErrorMessage(error) });
  }
};

export const confirmCheckoutSession = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      tenantId,
      customerId: contextCustomerId,
      userRef,
      userSnap,
      tenantRef,
    } = await resolveStripeUserContext(req, { allowFreeOwnerCheckout: true });
    const { sessionId } = req.body as { sessionId?: string };

    if (!sessionId) {
      return res.status(400).json({ message: "sessionId is required" });
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (!session) {
      return res.status(404).json({ message: "Checkout session not found" });
    }

    if (session.mode !== "subscription") {
      return res.status(400).json({ message: "Invalid checkout session mode" });
    }

    if (session.status !== "complete") {
      return res.status(400).json({ message: "Checkout session is not complete" });
    }

    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return res.status(400).json({ message: "Checkout payment not confirmed" });
    }

    const metadataUserId = session.metadata?.userId;
    if (metadataUserId && metadataUserId !== userId) {
      return res
        .status(403)
        .json({ message: "Session does not belong to authenticated user" });
    }
    const metadataTenantId = String(session.metadata?.tenantId || "").trim();
    if (metadataTenantId && metadataTenantId !== tenantId) {
      return res.status(403).json({ message: "Session tenant mismatch" });
    }
    if (session.metadata?.type === "addon") {
      return res.status(400).json({ message: "Use addon confirmation flow" });
    }

    const sessionCustomerId = getStripeCustomerId(
      session.customer as string | Stripe.Customer | null,
    );
    if (
      contextCustomerId &&
      sessionCustomerId &&
      contextCustomerId !== sessionCustomerId
    ) {
      return res.status(403).json({ message: "Stripe customer mismatch" });
    }

    let subscription =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

    if (!subscription) {
      return res
        .status(400)
        .json({ message: "No subscription found for session" });
    }

    assertSubscriptionOwnership(
      subscription as Stripe.Subscription,
      tenantId,
      contextCustomerId || sessionCustomerId,
    );

    const planTier = session.metadata?.planTier;
    const primaryPlanItem = getPrimaryPlanSubscriptionItem(subscription);
    const interval = primaryPlanItem?.price.recurring?.interval;

    if (planTier) {
      await updateUserPlan(
        userId,
        planTier,
        subscription.id,
        interval,
        new Date((subscription as any).current_period_end * 1000),
        subscription.cancel_at_period_end,
      );
    } else {
      await db
        .collection("users")
        .doc(userId)
        .update({
          stripeSubscriptionId: subscription.id,
          currentPeriodEnd: new Date(
            (subscription as any).current_period_end * 1000,
          ).toISOString(),
          subscriptionStatus: "active",
        });
    }

    const overageItemId = await addWhatsAppOverageToSubscription(subscription.id);
    if (overageItemId) {
      subscription = await stripe.subscriptions.retrieve(subscription.id);
    }

    const status = mapStripeSubscriptionStatus(subscription.status);
    const currentPeriodEnd = new Date(
      (subscription as any).current_period_end * 1000,
    );

    const whatsappItem = subscription.items.data.find(
      (item) => item.price.id === WHATSAPP_OVERAGE_PRICE_ID,
    );
    const userData = userSnap.exists
      ? (userSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const effectiveCustomerId =
      sessionCustomerId ||
      contextCustomerId ||
      String(userData?.stripeId || "").trim();

    await upsertTenantStripeBillingData({
      tenantId,
      stripeCustomerId: effectiveCustomerId,
      stripeSubscriptionId: subscription.id,
      whatsappOveragePriceId: WHATSAPP_OVERAGE_PRICE_ID,
      whatsappOverageSubscriptionItemId: whatsappItem?.id,
    });

    await Promise.all([
      tenantRef.set(
        {
          stripeCustomerId: effectiveCustomerId || null,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: status.toLowerCase(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ),
      userRef.set(
        {
          stripeId: effectiveCustomerId || null,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: status.toLowerCase(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ),
    ]);

    await updateSubscriptionStatus(
      userId,
      status,
      "Checkout Confirm",
      currentPeriodEnd,
      subscription.cancel_at_period_end,
    );

    return res.json({
      success: true,
      subscriptionId: subscription.id,
      planTier: planTier || undefined,
      status,
    });
  } catch (error: unknown) {
    console.error("Confirm Checkout Error:", error);
    return res.status(getErrorStatus(error)).json({ message: getErrorMessage(error) });
  }
};

export const previewPlanChange = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      tenantId,
      userSnap,
      tenantSnap,
      customerId: contextCustomerId,
    } = await resolveStripeUserContext(req);

    if (typeof req.body?.userId === "string" && req.body.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const planTier = String(req.body?.newPlanTier || req.body?.planTier || "")
      .trim()
      .toLowerCase();
    const rawBillingInterval = String(req.body?.billingInterval || "monthly")
      .toLowerCase()
      .trim();
    const validInterval: BillingInterval =
      rawBillingInterval === "yearly" ? "yearly" : "monthly";

    if (!planTier) {
      return res.status(400).json({ message: "Plan tier is required" });
    }

    const newPriceId = getPriceIdForTier(planTier, validInterval);
    if (!newPriceId) {
      return res
        .status(400)
        .json({ message: "Invalid plan tier or price not configured" });
    }

    const stripe = getStripe();
    const userData = userSnap.exists
      ? (userSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const tenantData = tenantSnap.exists
      ? (tenantSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const legacySubscriptionId = String(
      (userData as { subscription?: { id?: string } } | undefined)?.subscription
        ?.id || "",
    ).trim();
    const stripeSubscriptionId = String(
      tenantData?.stripeSubscriptionId ||
        userData?.stripeSubscriptionId ||
        legacySubscriptionId ||
        "",
    ).trim();

    if (!stripeSubscriptionId) {
      return res.json({
        amountDue: 0,
        currency: "brl",
        isNewSubscription: true,
      });
    }

    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    assertSubscriptionOwnership(subscription, tenantId, contextCustomerId);

    const customerId =
      getStripeCustomerId(subscription.customer as string | Stripe.Customer | null) ||
      contextCustomerId;
    if (!customerId) {
      return res.status(400).json({ message: "Stripe customer not found" });
    }

    const currentPlanItem = getPrimaryPlanSubscriptionItem(subscription);
    if (!currentPlanItem) {
      return res.status(400).json({ message: "Current plan item not found" });
    }

    const currentPriceAmount = Number(currentPlanItem.price.unit_amount || 0) / 100;
    const newPrice = await stripe.prices.retrieve(newPriceId);
    const newPriceAmount = Number(newPrice.unit_amount || 0) / 100;
    const newPlanRecurring = newPrice.recurring;
    const previewBillingCycleAnchor = resolvePlanChangeBillingCycleAnchor({
      currentRecurring: currentPlanItem.price.recurring,
      targetRecurring: newPlanRecurring,
    });

    const projectedItems = subscription.items.data.map((item) => {
      const shouldDeleteForMismatch =
        item.id !== currentPlanItem.id &&
        hasRecurringMismatch(newPlanRecurring, item.price.recurring);

      if (shouldDeleteForMismatch) {
        return { id: item.id, deleted: true };
      }

      if (item.id === currentPlanItem.id) {
        return { id: item.id, price: newPriceId };
      }

      return { id: item.id };
    });

    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      customer: customerId,
      subscription: subscription.id,
      subscription_details: {
        proration_behavior: "always_invoice",
        billing_cycle_anchor: previewBillingCycleAnchor,
        items: projectedItems,
      },
    });

    const amountDueRaw = Number(upcomingInvoice.amount_due || 0) / 100;
    const amountDue = Math.max(amountDueRaw, 0);
    const creditAmount = Math.max(-amountDueRaw, 0);

    let paymentMethod: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    } | null = null;

    const defaultPaymentMethod =
      typeof subscription.default_payment_method === "string"
        ? subscription.default_payment_method
        : subscription.default_payment_method?.id;

    if (defaultPaymentMethod) {
      const pm = await stripe.paymentMethods.retrieve(defaultPaymentMethod);
      if (pm.type === "card" && pm.card) {
        paymentMethod = {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        };
      }
    }

    const nextBillingDate = new Date(
      (subscription as any).current_period_end * 1000,
    ).toLocaleDateString("pt-BR");

    return res.json({
      amountDue,
      currency: String(upcomingInvoice.currency || "brl").toLowerCase(),
      isNewSubscription: false,
      preview: {
        currentPlan: {
          tier: String(subscription.metadata?.planTier || "atual"),
          price: currentPriceAmount,
          interval:
            currentPlanItem.price.recurring?.interval === "year"
              ? "yearly"
              : "monthly",
        },
        newPlan: {
          tier: planTier,
          price: newPriceAmount,
          interval: validInterval,
        },
        amountDue,
        creditAmount,
        isUpgrade: amountDue > 0 || newPriceAmount > currentPriceAmount,
        isDowngrade: creditAmount > 0 || newPriceAmount < currentPriceAmount,
        paymentMethod,
        nextBillingDate,
      },
    });
  } catch (error: unknown) {
    console.error("Preview Plan Change Error:", error);
    return res.status(getErrorStatus(error)).json({ message: getErrorMessage(error) });
  }
};

export const createPortalSession = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      tenantId,
      userRef,
      userSnap,
      tenantRef,
      tenantSnap,
      customerId: contextCustomerId,
    } = await resolveStripeUserContext(req);
    const userData = userSnap.exists
      ? (userSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const tenantData = tenantSnap.exists
      ? (tenantSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    let stripeId =
      contextCustomerId ||
      String(tenantData?.stripeCustomerId || "").trim() ||
      String(userData?.stripeId || "").trim() ||
      undefined;

    const stripe = getStripe();

    // If Stripe ID is missing, create a new customer
    if (!stripeId) {
      console.log(
        `[createPortalSession] Missing stripeId for user ${userId}. Creating new customer...`,
      );
      const email = isSafeEmail(userData?.email)
        ? String(userData?.email).trim()
        : isSafeEmail(req.user?.email)
          ? String(req.user?.email).trim()
          : undefined;

      const customer = await stripe.customers.create({
        email,
        metadata: { firebaseUID: userId, tenantId },
      });

      stripeId = customer.id;

      // Save for future use
      const nowIso = new Date().toISOString();
      await Promise.all([
        userRef.set({ stripeId, updatedAt: nowIso }, { merge: true }),
        tenantRef.set(
          { stripeCustomerId: stripeId, updatedAt: nowIso },
          { merge: true },
        ),
      ]);
    }

    if (!stripeId) {
      throw new Error("BAD_REQUEST");
    }

    const appOrigin = resolveRequestOrigin(req);

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeId,
      return_url: `${appOrigin}/profile`,
    });

    return res.json({ url: session.url });
  } catch (error: unknown) {
    console.error("Portal Session Error:", error);
    return res.status(getErrorStatus(error)).json({ message: getErrorMessage(error) });
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
    const {
      userId,
      tenantId,
      customerId,
      userRef,
      userSnap,
      tenantRef,
      tenantSnap,
    } = await resolveStripeUserContext(req);
    const userData = userSnap.exists
      ? (userSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const tenantData = tenantSnap.exists
      ? (tenantSnap.data() as Record<string, unknown> | undefined)
      : undefined;
    const legacySubscriptionId = String(
      (userData as { subscription?: { id?: string } })?.subscription?.id || "",
    ).trim();

    const stripeSubscriptionId = String(
      tenantData?.stripeSubscriptionId ||
        userData?.stripeSubscriptionId ||
        legacySubscriptionId ||
        "",
    ).trim();

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
    assertSubscriptionOwnership(subscription, tenantId, customerId);

    const status = mapStripeSubscriptionStatus(subscription.status);

    const currentPeriodEnd = new Date(
      (subscription as any).current_period_end * 1000,
    );

    await updateSubscriptionStatus(
      userId,
      status,
      "Manual Sync",
      currentPeriodEnd,
      subscription.cancel_at_period_end,
    );

    await Promise.all([
      tenantRef.set(
        {
          stripeSubscriptionId,
          stripeCustomerId: getStripeCustomerId(
            subscription.customer as string | Stripe.Customer | null,
          ),
          subscriptionStatus: status.toLowerCase(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ),
      userRef.set(
        {
          stripeSubscriptionId,
          subscriptionStatus: status.toLowerCase(),
          currentPeriodEnd: currentPeriodEnd.toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      ),
    ]);

    return res.json({
      success: true,
      data: {
        status,
        currentPeriodEnd: currentPeriodEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error("Sync Subscription Error:", error);
    return res.status(getErrorStatus(error)).json({ message: getErrorMessage(error) });
  }
};

export const syncAllSubscriptions = async (req: Request, res: Response) => {
  try {
    try {
      assertSuperAdminClaim(req);
    } catch {
      return res
        .status(403)
        .json({ message: "Only superadmin can run batch sync" });
    }

    const body = (req.body || {}) as {
      dryRun?: boolean;
      limit?: number;
      startAfterId?: string;
    };

    const dryRun = body.dryRun !== false;
    const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 500);
    const startAfterId =
      typeof body.startAfterId === "string" &&
      body.startAfterId.trim().length > 0
        ? body.startAfterId.trim()
        : undefined;

    const result = await runStripeSync(limit, startAfterId, dryRun);

    return res.json({
      success: true,
      dryRun,
      ...result,
    });
  } catch (error) {
    console.error("Batch sync subscriptions error:", error);
    return res.status(getErrorStatus(error)).json({ message: getErrorMessage(error) });
  }
};
