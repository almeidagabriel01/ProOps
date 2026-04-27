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

function validateMPSignature(req: { headers: Record<string, string | string[] | undefined> }, body: MpWebhookBody): boolean {
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

  const manifest = `${xRequestId};${dataId};${ts}`;
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

    if (!validateMPSignature(req, body)) {
      logger.warn("MP webhook: invalid signature", {
        xSignature: req.headers["x-signature"],
        xRequestId: req.headers["x-request-id"],
      });
      // Retorna 200 para evitar retries do MP em caso de misconfiguration de secret
      res.status(200).send("OK");
      return;
    }

    const { action, data } = body;

    if (
      (action === "payment.updated" || action === "payment.created") &&
      data?.id
    ) {
      try {
        await handlePaymentEvent(data.id);
      } catch (err) {
        logger.error("MP webhook: error handling payment event", {
          action,
          dataId: data.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      logger.info("MP webhook: ignoring unhandled action", { action });
    }

    res.status(200).send("OK");
  },
);
