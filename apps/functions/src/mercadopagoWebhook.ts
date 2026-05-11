import { onRequest } from "firebase-functions/v2/https";
import axios from "axios";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "./init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./lib/logger";
import { MercadoPagoService } from "./api/services/mercadopago.service";
import { resolveWalletRef } from "./lib/finance-helpers";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;
const MP_API_BASE = "https://api.mercadopago.com";
const PAYMENT_ATTEMPTS_COLLECTION = "payment_attempts";

/** Replica local da lógica de getWalletImpacts (privada em transaction.service.ts). */
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

interface MpWebhookBody {
  action?: string;
  data?: { id?: string };
}

interface MpPaymentResponse {
  id: number;
  status: string;
  transaction_amount: number;
  date_approved?: string;
}

export function validateMPSignature(req: { headers: Record<string, string | string[] | undefined> }, body: MpWebhookBody): boolean {
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!webhookSecret) return false;

  const xSignature = req.headers["x-signature"] as string | undefined;
  const xRequestId = req.headers["x-request-id"] as string | undefined;

  if (!xSignature || !xRequestId) return false;

  const tsMatch = xSignature.match(/ts=([^,]+)/);
  const v1Match = xSignature.match(/v1=([^,]+)/);
  if (!tsMatch || !v1Match) return false;

  const ts = tsMatch[1];
  const providedHmac = v1Match[1];
  const dataId = body.data?.id || "";

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", webhookSecret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(providedHmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function handlePaymentEvent(dataId: string): Promise<void> {
  // 1. Find payment attempt by mpPaymentId
  const attemptsSnap = await db
    .collection(PAYMENT_ATTEMPTS_COLLECTION)
    .where("mpPaymentId", "==", dataId)
    .limit(1)
    .get();

  if (attemptsSnap.empty) {
    logger.info("MP webhook: no payment attempt found, ignoring", { mpPaymentId: dataId });
    return;
  }

  const attemptDoc = attemptsSnap.docs[0];
  const attempt = attemptDoc.data() as {
    transactionId: string;
    tenantId: string;
    status: string;
  };

  const { transactionId, tenantId } = attempt;

  // 2. Get MP access token for this tenant
  const mpData = await MercadoPagoService.getMercadoPagoData(tenantId);
  if (!mpData) {
    logger.warn("MP webhook: tenant not connected to MercadoPago", { tenantId, mpPaymentId: dataId });
    return;
  }

  const sandboxAccessToken = process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN;
  const attemptEnvironment = (attemptDoc.data() as { environment?: string }).environment;
  const effectiveAccessToken =
    attemptEnvironment === "sandbox" && sandboxAccessToken
      ? sandboxAccessToken
      : mpData.accessToken;

  // 3. Fetch payment status from MP API
  const mpResponse = await axios.get<MpPaymentResponse>(
    `${MP_API_BASE}/v1/payments/${dataId}`,
    { headers: { Authorization: `Bearer ${effectiveAccessToken}` } },
  );

  const mpPayment = mpResponse.data;
  const mpStatus = mpPayment.status;

  logger.info("MP webhook: payment status fetched", {
    tenantId,
    transactionId,
    mpPaymentId: dataId,
    mpStatus,
  });

  if (mpStatus === "approved") {
    const paidAt = mpPayment.date_approved || new Date().toISOString();

    await db.runTransaction(async (t) => {
      const transactionRef = db.collection("transactions").doc(transactionId);
      const txSnap = await t.get(transactionRef);

      if (!txSnap.exists) {
        logger.warn("MP webhook: transaction not found", { transactionId });
        return;
      }

      const txData = txSnap.data() as Record<string, unknown>;

      // Idempotência: já processado
      const paymentField = txData.payment as Record<string, unknown> | undefined;
      if (paymentField?.mpPaymentId === dataId && txData.status === "paid") {
        logger.info("MP webhook: payment already processed, skipping", {
          tenantId,
          transactionId,
          mpPaymentId: dataId,
        });
        return;
      }

      // Calcular delta de carteira: old (estado atual) → new (status "paid")
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

      // Reads antes de writes (regra Firestore Transaction)
      const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const [wallet, delta] of walletAdjustments.entries()) {
        if (delta === 0) continue;
        const walletInfo = await resolveWalletRef(t, db, tenantId, wallet);
        if (!walletInfo) {
          logger.error("MP webhook: wallet not found", { tenantId, wallet });
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
        "payment.mpPaymentId": dataId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      for (const [wallet, delta] of walletAdjustments.entries()) {
        if (delta === 0) continue;
        const walletRef = walletRefs.get(wallet);
        if (walletRef) {
          t.update(walletRef, { balance: FieldValue.increment(delta) });
        }
      }

      t.update(attemptDoc.ref, {
        status: "approved",
        processedAt: new Date().toISOString(),
      });
    });

    // Notificação: write direto fora da transaction (não crítico)
    try {
      await db.collection("notifications").add({
        tenantId,
        type: "transaction_paid_online",
        title: "Pagamento recebido",
        message: `Pagamento via Mercado Pago confirmado para o lançamento.`,
        transactionId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    } catch (notifErr) {
      logger.warn("MP webhook: failed to create notification (non-critical)", {
        tenantId,
        transactionId,
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    logger.info("MP webhook: transaction marked as paid", {
      tenantId,
      transactionId,
      mpPaymentId: dataId,
    });
    return;
  }

  // rejected | refunded | cancelled → atualiza apenas payment.status e attempt.status
  if (mpStatus === "rejected" || mpStatus === "refunded" || mpStatus === "cancelled") {
    const batch = db.batch();

    const transactionRef = db.collection("transactions").doc(transactionId);
    batch.update(transactionRef, {
      "payment.status": mpStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.update(attemptDoc.ref, {
      status: mpStatus,
      processedAt: new Date().toISOString(),
    });

    await batch.commit();

    logger.info("MP webhook: payment status updated (non-approved)", {
      tenantId,
      transactionId,
      mpPaymentId: dataId,
      mpStatus,
    });
  }
}

// ---------------------------------------------------------------------------
// Idempotency gate — mirrors beginStripeEventProcessing (Phase 19 BILL-08 pattern)
// Scoped to payment.* events ONLY — merchant_order and unknown topics MUST NOT
// write to webhookEvents (per CONTEXT.md § merchant_order event handling).
// ---------------------------------------------------------------------------

const WEBHOOK_EVENTS_COLLECTION = "webhookEvents";
const PROCESSING_STUCK_WINDOW_MS = 5 * 60 * 1000; // 5 min — mirrors Stripe stuck-processing window

type MpWebhookEventStatus = "processing" | "done" | "skipped" | "failed";

interface MpWebhookEventRecord {
  action: string;
  dataId: string;
  receivedAt: FirebaseFirestore.Timestamp | null;
  status: MpWebhookEventStatus;
  lastProcessedAt?: string;
  lastError?: string | null;
}

function shouldSkipMpWebhookEventRecord(data: MpWebhookEventRecord | undefined): boolean {
  if (!data) return false;
  if (data.status === "done" || data.status === "skipped") return true;
  if (data.status === "processing") {
    const receivedAtMs = data.receivedAt?.toMillis() ?? 0;
    if (receivedAtMs > 0 && Date.now() - receivedAtMs < PROCESSING_STUCK_WINDOW_MS) {
      return true;
    }
  }
  // status === "failed" → allow retry
  return false;
}

export async function beginMpWebhookProcessing(
  xRequestId: string,
  body: MpWebhookBody,
): Promise<"skip" | "process"> {
  const eventRef = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(xRequestId);
  return db.runTransaction(async (t) => {
    const snap = await t.get(eventRef);
    if (snap.exists) {
      const data = snap.data() as MpWebhookEventRecord | undefined;
      if (shouldSkipMpWebhookEventRecord(data)) {
        logger.info("MP webhook: duplicate event, skipping", {
          xRequestId,
          existingStatus: data?.status,
          result: "skipped_idempotent",
        });
        return "skip";
      }
    }
    t.set(eventRef, {
      action: body.action ?? "",
      dataId: body.data?.id ?? "",
      receivedAt: FieldValue.serverTimestamp(),
      status: "processing",
    }, { merge: true });
    return "process";
  });
}

export async function finalizeMpWebhookProcessing(
  xRequestId: string,
  status: "done" | "skipped" | "failed",
  errorMessage?: string,
): Promise<void> {
  const ref = db.collection(WEBHOOK_EVENTS_COLLECTION).doc(xRequestId);
  await ref.set({
    status,
    lastProcessedAt: new Date().toISOString(),
    lastError: status === "failed" ? (errorMessage ?? "unknown") : null,
  }, { merge: true });
}

// ---------------------------------------------------------------------------
// onRequest handler
// ---------------------------------------------------------------------------

export const mercadopagoWebhook = onRequest(
  {
    region: "southamerica-east1",
    memory: "512MiB",
    maxInstances: 10,
    timeoutSeconds: 60,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const contentLength = parseInt(String(req.headers["content-length"] || "0"), 10);
    if (contentLength > MAX_WEBHOOK_BODY_BYTES) {
      logger.warn("MP webhook: payload too large", { contentLength });
      res.status(200).send("OK");
      return;
    }

    const body = req.body as MpWebhookBody;
    const xRequestId = (req.headers["x-request-id"] as string | undefined) ?? "";

    logger.info("MP webhook: received", {
      xRequestId,
      xSignaturePresent: !!req.headers["x-signature"], // boolean only — NEVER log raw value
      action: body.action ?? "unknown",
      type: (body as { type?: string }).type ?? null, // also log topic for diagnosing merchant_order
      dataId: body.data?.id ?? null,
    });

    const hmacValid = validateMPSignature(req, body);
    if (!hmacValid) {
      logger.warn("MP webhook: invalid signature", {
        xRequestId,
        action: body.action ?? "unknown",
        hmacValid: false,
      });
      // Retorna 200 para evitar retries do MP em caso de misconfiguration de secret
      res.status(200).send("OK");
      return;
    }

    logger.info("MP webhook: hmac validated", { xRequestId, hmacValid: true, action: body.action });

    const { action, data } = body;
    const topic = (body as { type?: string }).type;

    // Step 1: Action routing BEFORE idempotency gate.
    // Non-payment events return 200 with NO Firestore writes (per CONTEXT.md § merchant_order event handling).
    if (action !== "payment.created" && action !== "payment.updated") {
      if (topic === "merchant_order") {
        logger.info("MP webhook: ignoring merchant_order event", {
          xRequestId,
          action: action ?? null,
          type: topic,
          dataId: data?.id ?? null,
        });
      } else {
        // Truly unknown / unhandled topic — warn (per CONTEXT.md: unknown topics → log warn)
        logger.warn("MP webhook: unhandled topic", {
          xRequestId,
          action: action ?? null,
          type: topic ?? null,
          dataId: data?.id ?? null,
        });
      }
      res.status(200).send("OK");
      return; // NO beginMpWebhookProcessing call, NO webhookEvents document write
    }

    // Step 2: Sanity — payment events MUST carry data.id
    if (!data?.id) {
      logger.warn("MP webhook: payment event missing data.id", {
        xRequestId,
        action,
      });
      res.status(200).send("OK");
      return; // NO Firestore writes — malformed payment event is not an idempotency concern
    }

    // Step 3: xRequestId presence guard — cannot idempotency-gate without a key
    if (!xRequestId) {
      logger.warn("MP webhook: missing x-request-id header", {
        action,
        result: "missing_request_id",
      });
      res.status(200).send("OK");
      return;
    }

    // Step 4: Idempotency gate (payment.* ONLY)
    const decision = await beginMpWebhookProcessing(xRequestId, body);
    if (decision === "skip") {
      res.status(200).send("OK");
      return; // log already emitted inside beginMpWebhookProcessing
    }

    // Step 5: Process payment event — unexpected errors → status:"failed" → HTTP 500 so MP retries
    try {
      await handlePaymentEvent(data.id);
      await finalizeMpWebhookProcessing(xRequestId, "done");
      res.status(200).send("OK");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("MP webhook: unexpected error after idempotency gate", {
        xRequestId,
        action: body.action,
        dataId: body.data?.id,
        error: message,
      });
      await finalizeMpWebhookProcessing(xRequestId, "failed", message);
      res.status(500).send("Internal Server Error");
    }
  },
);
