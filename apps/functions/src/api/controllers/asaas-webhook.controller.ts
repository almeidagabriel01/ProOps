import crypto from "node:crypto";
import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import { resolveWalletRef } from "../../lib/finance-helpers";
import { schedulePayoutTransfer } from "../services/payout-transfer.service";
import type { TenantAsaasData } from "../services/asaas.service";

const PAYMENT_ATTEMPTS_COLLECTION = "payment_attempts";
const WEBHOOK_EVENTS_COLLECTION = "webhookEvents";
const PROCESSING_STUCK_WINDOW_MS = 5 * 60 * 1000; // 5 min

// Relevant Asaas payment events that indicate a successful payment
const PAYMENT_SUCCESS_EVENTS = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
]);

interface AsaasWebhookPayload {
  event?: string;
  payment?: {
    id: string;
    externalReference?: string;
    status?: string;
    value?: number;
    netValue?: number;
    billingType?: string;
  };
}

interface WebhookEventRecord {
  event: string;
  asaasPaymentId: string;
  tenantId: string;
  receivedAt: FirebaseFirestore.FieldValue | null;
  status: "processing" | "done" | "skipped" | "failed";
  lastProcessedAt?: string;
  lastError?: string | null;
}

/**
 * Parses externalReference field written by transaction-payment.service.ts.
 * Format: `${transactionId}:${attemptId}`
 */
function parseExternalReference(
  ref: string | undefined | null,
): { transactionId: string; attemptId: string } | null {
  if (!ref || typeof ref !== "string") return null;
  const parts = ref.split(":");
  if (parts.length !== 2) return null;
  const transactionId = parts[0].trim();
  const attemptId = parts[1].trim();
  if (!transactionId || !attemptId) return null;
  return { transactionId, attemptId };
}

/** Replica of computeWalletImpacts from mercadopagoWebhook.ts. */
function computeWalletImpacts(data: Record<string, unknown>): Map<string, number> {
  const impacts = new Map<string, number>();
  if (!data) return impacts;

  const type = data.type as string | undefined;
  const sign = type === "income" ? 1 : -1;
  const amount = typeof data.amount === "number" ? data.amount : 0;

  if (data.status === "paid" && data.wallet && typeof data.wallet === "string") {
    impacts.set(data.wallet, (impacts.get(data.wallet) || 0) + sign * amount);
  }

  if (Array.isArray(data.extraCosts)) {
    for (const ec of data.extraCosts as Array<Record<string, unknown>>) {
      const ecWallet = (ec.wallet || data.wallet) as string | undefined;
      const ecAmount = typeof ec.amount === "number" ? ec.amount : 0;
      if (ec.status === "paid" && ecWallet) {
        impacts.set(ecWallet, (impacts.get(ecWallet) || 0) + sign * ecAmount);
      }
    }
  }

  return impacts;
}

function shouldSkipWebhookEvent(
  data: WebhookEventRecord | undefined,
): boolean {
  if (!data) return false;
  if (data.status === "done" || data.status === "skipped") return true;
  if (data.status === "processing") {
    const receivedAtMs =
      (data.receivedAt as FirebaseFirestore.Timestamp | null)?.toMillis?.() ?? 0;
    if (receivedAtMs > 0 && Date.now() - receivedAtMs < PROCESSING_STUCK_WINDOW_MS) {
      return true;
    }
  }
  return false;
}

async function beginWebhookProcessing(
  idempotencyKey: string,
  event: string,
  asaasPaymentId: string,
  tenantId: string,
): Promise<"skip" | "process"> {
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(idempotencyKey);
  return db.runTransaction(async (t) => {
    const snap = await t.get(eventRef);
    if (snap.exists) {
      const data = snap.data() as WebhookEventRecord | undefined;
      if (shouldSkipWebhookEvent(data)) {
        logger.info("Asaas webhook: duplicate event, skipping", {
          idempotencyKey,
          existingStatus: data?.status,
        });
        return "skip";
      }
    }
    t.set(
      eventRef,
      {
        event,
        asaasPaymentId,
        tenantId,
        receivedAt: FieldValue.serverTimestamp(),
        status: "processing",
      },
      { merge: true },
    );
    return "process";
  });
}

async function finalizeWebhookProcessing(
  idempotencyKey: string,
  status: "done" | "skipped" | "failed",
  errorMessage?: string,
): Promise<void> {
  const ref = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(idempotencyKey);
  await ref.set(
    {
      status,
      lastProcessedAt: new Date().toISOString(),
      lastError: status === "failed" ? (errorMessage ?? "unknown") : null,
    },
    { merge: true },
  );
}

async function handlePaymentSuccess(
  tenantId: string,
  asaasPaymentId: string,
  attemptId: string,
  transactionId: string,
): Promise<void> {
  const paidAt = new Date().toISOString();

  await db.runTransaction(async (t) => {
    const transactionRef = db.collection("transactions").doc(transactionId);
    const attemptRef = db.collection(PAYMENT_ATTEMPTS_COLLECTION).doc(attemptId);

    const [txSnap, attemptSnap] = await Promise.all([
      t.get(transactionRef),
      t.get(attemptRef),
    ]);

    if (!txSnap.exists) {
      logger.warn("Asaas webhook: transaction not found", { transactionId, tenantId });
      return;
    }

    if (!attemptSnap.exists) {
      logger.warn("Asaas webhook: payment attempt not found", {
        attemptId,
        transactionId,
        tenantId,
      });
      return;
    }

    const attemptData = attemptSnap.data() as Record<string, unknown>;
    if (attemptData.tenantId !== tenantId) {
      logger.warn("Asaas webhook: attempt tenantId mismatch", {
        attemptTenantId: attemptData.tenantId,
        webhookTenantId: tenantId,
        attemptId,
      });
      return;
    }

    const txData = txSnap.data() as Record<string, unknown>;

    // Idempotência: já processado
    const paymentField = txData.payment as Record<string, unknown> | undefined;
    if (
      paymentField?.gatewayPaymentId === asaasPaymentId &&
      txData.status === "paid"
    ) {
      logger.info("Asaas webhook: payment already processed, skipping", {
        tenantId,
        transactionId,
        asaasPaymentId,
      });
      return;
    }

    // Compute wallet deltas: old state → new (paid) state
    const oldImpacts = computeWalletImpacts(txData);
    const newTxData = { ...txData, status: "paid" };
    const newImpacts = computeWalletImpacts(newTxData);

    const walletAdjustments = new Map<string, number>();
    for (const [wallet, amount] of oldImpacts.entries()) {
      walletAdjustments.set(wallet, (walletAdjustments.get(wallet) || 0) - amount);
    }
    for (const [wallet, amount] of newImpacts.entries()) {
      walletAdjustments.set(wallet, (walletAdjustments.get(wallet) || 0) + amount);
    }

    // Reads before writes (Firestore Transaction rule)
    const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
    for (const [wallet, delta] of walletAdjustments.entries()) {
      if (delta === 0) continue;
      const walletInfo = await resolveWalletRef(t, db, tenantId, wallet);
      if (!walletInfo) {
        logger.error("Asaas webhook: wallet not found", { tenantId, wallet });
        throw new Error(`Carteira "${wallet}" não encontrada.`);
      }
      walletRefs.set(wallet, walletInfo.ref);
    }

    // Writes
    t.update(transactionRef, {
      status: "paid",
      paidAt,
      "payment.status": "approved",
      "payment.paidAt": paidAt,
      "payment.gatewayPaymentId": asaasPaymentId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    for (const [wallet, delta] of walletAdjustments.entries()) {
      if (delta === 0) continue;
      const walletRef = walletRefs.get(wallet);
      if (walletRef) {
        t.update(walletRef, { balance: FieldValue.increment(delta) });
      }
    }

    t.update(attemptRef, {
      status: "completed",
      processedAt: new Date().toISOString(),
    });
  });

  // Notification: write outside transaction (non-critical, best-effort)
  try {
    await db.collection("notifications").add({
      tenantId,
      type: "transaction_paid_online",
      title: "Pagamento recebido",
      message: "Pagamento via Asaas confirmado para o lançamento.",
      transactionId,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (notifErr) {
    logger.warn("Asaas webhook: failed to create notification (non-critical)", {
      tenantId,
      transactionId,
      error:
        notifErr instanceof Error ? notifErr.message : String(notifErr),
    });
  }

  logger.info("Asaas webhook: transaction marked as paid", {
    tenantId,
    transactionId,
    asaasPaymentId,
  });
}

export const handleAsaasWebhook = async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;

  if (!tenantId) {
    // Should never happen given route definition, but guard anyway
    res.status(200).send("OK");
    return;
  }

  const body = req.body as AsaasWebhookPayload;
  const event = body.event ?? "UNKNOWN";
  const asaasPaymentId = body.payment?.id ?? "";

  logger.info("Asaas webhook: received", {
    tenantId,
    event,
    asaasPaymentId: asaasPaymentId || null,
  });

  // Step 1: Verify auth token against tenant's stored webhookAuthToken
  const providedToken = req.headers["asaas-access-token"] as string | undefined;

  let tenantDataRecord: Record<string, unknown> = {};

  try {
    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    if (!tenantSnap.exists) {
      logger.warn("Asaas webhook: tenant not found", { tenantId });
      // Return 200 to avoid Asaas retries on unknown tenants
      res.status(200).send("OK");
      return;
    }

    tenantDataRecord = tenantSnap.data() as Record<string, unknown>;
    const authCheck = tenantDataRecord as { asaas?: { webhookAuthToken?: string } };
    const storedToken = authCheck.asaas?.webhookAuthToken;

    if (!storedToken || !providedToken) {
      logger.warn("Asaas webhook: invalid auth token", {
        tenantId,
        event,
        hasProvidedToken: !!providedToken,
        hasStoredToken: !!storedToken,
      });
      // Return 200 to avoid retry loops — auth failure is permanent
      res.status(200).send("OK");
      return;
    }
    const providedBuf = Buffer.from(providedToken, "utf-8");
    const storedBuf = Buffer.from(storedToken, "utf-8");
    if (
      providedBuf.length !== storedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, storedBuf)
    ) {
      logger.warn("Asaas webhook: invalid auth token", {
        tenantId,
        event,
        hasProvidedToken: !!providedToken,
        hasStoredToken: !!storedToken,
      });
      // Return 200 to avoid retry loops — auth failure is permanent
      res.status(200).send("OK");
      return;
    }
  } catch (tenantErr) {
    logger.error("Asaas webhook: error reading tenant for auth", {
      tenantId,
      error: tenantErr instanceof Error ? tenantErr.message : String(tenantErr),
    });
    res.status(200).send("OK");
    return;
  }

  // Step 2: Ignore irrelevant events
  if (!PAYMENT_SUCCESS_EVENTS.has(event)) {
    logger.info("Asaas webhook: ignoring non-payment-success event", {
      tenantId,
      event,
    });
    res.status(200).send("OK");
    return;
  }

  // Step 3: Require payment.id
  if (!asaasPaymentId) {
    logger.warn("Asaas webhook: payment event missing payment.id", {
      tenantId,
      event,
    });
    res.status(200).send("OK");
    return;
  }

  // Step 4: Parse externalReference
  const parsed = parseExternalReference(body.payment?.externalReference);
  if (!parsed) {
    logger.warn("Asaas webhook: externalReference missing or malformed", {
      tenantId,
      event,
      asaasPaymentId,
      externalReference: body.payment?.externalReference ?? null,
    });
    res.status(200).send("OK");
    return;
  }

  const { transactionId, attemptId } = parsed;

  // Step 5: Idempotency gate keyed on asaasPaymentId + tenantId
  const idempotencyKey = `asaas:${tenantId}:${asaasPaymentId}`;
  const decision = await beginWebhookProcessing(
    idempotencyKey,
    event,
    asaasPaymentId,
    tenantId,
  );

  if (decision === "skip") {
    res.status(200).send("OK");
    return;
  }

  // Step 6: Process payment
  try {
    await handlePaymentSuccess(tenantId, asaasPaymentId, attemptId, transactionId);
    await finalizeWebhookProcessing(idempotencyKey, "done");

    // Auto-transfer to external PIX key if configured
    if (event === "PAYMENT_RECEIVED") {
      const netValue = body.payment?.netValue;
      const tenantAsaas = tenantDataRecord.asaas as TenantAsaasData | undefined;
      const payout = tenantAsaas?.payout;
      if (
        payout?.enabled &&
        payout.pixAddressKey &&
        typeof netValue === "number" &&
        netValue > 0
      ) {
        schedulePayoutTransfer({
          tenantId,
          asaasPaymentId,
          transactionId,
          netValue,
          payout,
          apiKey: tenantAsaas!.apiKey,
          environment: tenantAsaas!.environment,
        }).catch((payoutErr) => {
          logger.error("Asaas webhook: payout transfer scheduling failed", {
            tenantId,
            asaasPaymentId,
            error: payoutErr instanceof Error ? payoutErr.message : String(payoutErr),
          });
        });
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Asaas webhook: unexpected error during payment processing", {
      tenantId,
      event,
      asaasPaymentId,
      transactionId,
      error: message,
    });
    await finalizeWebhookProcessing(idempotencyKey, "failed", message);
    // Return 500 so Asaas can retry transient failures
    res.status(500).send("Internal Server Error");
  }
};

/**
 * Processes a payment success event directly (used by sandbox simulation to bypass webhook delivery).
 * Reuses the same idempotency gate and handlePaymentSuccess logic as the real webhook.
 */
export async function processAsaasPaymentLocally(
  tenantId: string,
  asaasPaymentId: string,
  externalReference: string,
  netValue: number,
): Promise<void> {
  const parsed = parseExternalReference(externalReference);
  if (!parsed) {
    throw new Error(`Invalid externalReference: ${externalReference}`);
  }
  const { transactionId, attemptId } = parsed;

  const idempotencyKey = `asaas:${tenantId}:${asaasPaymentId}`;
  const decision = await beginWebhookProcessing(
    idempotencyKey,
    "PAYMENT_RECEIVED",
    asaasPaymentId,
    tenantId,
  );

  if (decision === "skip") {
    logger.info("processAsaasPaymentLocally: already processed, skipping", {
      tenantId,
      asaasPaymentId,
    });
    return;
  }

  try {
    await handlePaymentSuccess(tenantId, asaasPaymentId, attemptId, transactionId);
    await finalizeWebhookProcessing(idempotencyKey, "done");

    // Trigger payout transfer if configured (same as real webhook)
    try {
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      const tenantDataRecord = tenantSnap.data() as Record<string, unknown> ?? {};
      const tenantAsaas = tenantDataRecord.asaas as TenantAsaasData | undefined;
      const payout = tenantAsaas?.payout;
      if (payout?.enabled && payout.pixAddressKey && netValue > 0) {
        schedulePayoutTransfer({
          tenantId,
          asaasPaymentId,
          transactionId,
          netValue,
          payout,
          apiKey: tenantAsaas!.apiKey,
          environment: tenantAsaas!.environment,
        }).catch((payoutErr) => {
          logger.error("processAsaasPaymentLocally: payout scheduling failed", {
            tenantId,
            error: payoutErr instanceof Error ? payoutErr.message : String(payoutErr),
          });
        });
      }
    } catch (payoutCheckErr) {
      logger.warn("processAsaasPaymentLocally: error checking payout config (non-fatal)", {
        tenantId,
        error: payoutCheckErr instanceof Error ? payoutCheckErr.message : String(payoutCheckErr),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finalizeWebhookProcessing(idempotencyKey, "failed", message);
    throw err;
  }
}
