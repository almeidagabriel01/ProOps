import axios from "axios";
import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import { AsaasService, TenantAsaasData } from "./asaas.service";

const PAYOUT_ATTEMPTS_COLLECTION = "payout_attempts";
const MAX_RETRY_COUNT = 5;
const RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hour

export interface PayoutConfig {
  enabled: boolean;
  pixAddressKey: string;
  pixAddressKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM_KEY";
}

export interface SchedulePayoutArgs {
  tenantId: string;
  asaasPaymentId: string;
  transactionId: string;
  netValue: number;
  payout: PayoutConfig;
  apiKey: string;
  environment: TenantAsaasData["environment"];
}

/**
 * Called after PAYMENT_RECEIVED. Creates attempt doc (idempotent) and tries transfer immediately.
 */
export async function schedulePayoutTransfer(args: SchedulePayoutArgs): Promise<void> {
  const attemptId = `${args.tenantId}_${args.asaasPaymentId}`;
  const attemptRef = db.collection(PAYOUT_ATTEMPTS_COLLECTION).doc(attemptId);
  const now = new Date().toISOString();

  try {
    await attemptRef.create({
      tenantId: args.tenantId,
      asaasPaymentId: args.asaasPaymentId,
      transactionId: args.transactionId,
      netValue: args.netValue,
      payout: {
        pixAddressKey: args.payout.pixAddressKey,
        pixAddressKeyType: args.payout.pixAddressKeyType,
      },
      apiKey: args.apiKey,
      environment: args.environment,
      status: "pending",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch (createErr) {
    // already-exists means we already processed this payment — idempotent
    if ((createErr as { code?: string }).code === "already-exists") {
      logger.info("Payout attempt already exists, skipping", { attemptId });
      return;
    }
    throw createErr;
  }

  // Try transfer immediately
  await executeTransfer(attemptId).catch((err) => {
    logger.error("Payout transfer failed during initial attempt", {
      attemptId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Executes (or retries) the transfer for a given attempt ID.
 */
export async function executeTransfer(attemptId: string): Promise<void> {
  const attemptRef = db.collection(PAYOUT_ATTEMPTS_COLLECTION).doc(attemptId);
  const snap = await attemptRef.get();
  if (!snap.exists) {
    logger.warn("executeTransfer: attempt not found", { attemptId });
    return;
  }

  const data = snap.data() as {
    tenantId: string;
    asaasPaymentId: string;
    transactionId: string;
    netValue: number;
    payout: { pixAddressKey: string; pixAddressKeyType: string };
    apiKey: string;
    environment: string;
    status: string;
    retryCount: number;
  };

  if (data.status === "sent") {
    logger.info("executeTransfer: already sent, skipping", { attemptId });
    return;
  }

  if (data.retryCount >= MAX_RETRY_COUNT) {
    await attemptRef.update({
      status: "failed",
      lastError: "Max retry count reached",
      updatedAt: new Date().toISOString(),
    });
    await notifyPayoutFailed(
      data.tenantId,
      data.transactionId,
      data.netValue,
      "Número máximo de tentativas atingido",
    );
    return;
  }

  const baseUrl = AsaasService.getBaseUrl(data.environment as "sandbox" | "production");
  const externalReference = `${data.tenantId}:${data.asaasPaymentId}`;

  try {
    const response = await axios.post<{ id: string; status: string }>(
      `${baseUrl}/v3/transfers`,
      {
        value: data.netValue,
        pixAddressKey: data.payout.pixAddressKey,
        pixAddressKeyType: data.payout.pixAddressKeyType,
        description: `Repasse ProOps - tx ${data.transactionId}`,
        externalReference,
      },
      { headers: { access_token: data.apiKey, "Content-Type": "application/json" } },
    );

    await attemptRef.update({
      status: "sent",
      asaasTransferId: response.data.id,
      transferStatus: response.data.status,
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    logger.info("Payout transfer sent", {
      attemptId,
      tenantId: data.tenantId,
      transactionId: data.transactionId,
      netValue: data.netValue,
      asaasTransferId: response.data.id,
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data as Record<string, unknown> | undefined;
      const errors = Array.isArray(body?.errors)
        ? (body.errors as Array<{ description: string }>)
        : [];
      const errorMsg =
        errors[0]?.description ||
        (typeof body?.message === "string" ? body.message : "Erro desconhecido");

      const isInsufficientBalance =
        /saldo|balance|insufficient|insuficiente/i.test(errorMsg);

      if (isInsufficientBalance && data.retryCount < MAX_RETRY_COUNT) {
        const nextRetryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
        await attemptRef.update({
          status: "pending_balance",
          retryCount: FieldValue.increment(1),
          nextRetryAt,
          lastError: errorMsg,
          updatedAt: new Date().toISOString(),
        });
        logger.warn("Payout transfer: insufficient balance, retry scheduled", {
          attemptId,
          nextRetryAt,
        });
        return;
      }

      // Non-retriable error
      await attemptRef.update({
        status: "failed",
        lastError: errorMsg,
        retryCount: FieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });
      await notifyPayoutFailed(data.tenantId, data.transactionId, data.netValue, errorMsg);
      logger.error("Payout transfer failed (non-retriable)", {
        attemptId,
        error: errorMsg,
      });
      return;
    }

    const message = err instanceof Error ? err.message : String(err);
    await attemptRef.update({
      status: "failed",
      lastError: message,
      retryCount: FieldValue.increment(1),
      updatedAt: new Date().toISOString(),
    });
    await notifyPayoutFailed(data.tenantId, data.transactionId, data.netValue, message);
    logger.error("Payout transfer unexpected error", { attemptId, error: message });
  }
}

async function notifyPayoutFailed(
  tenantId: string,
  transactionId: string,
  amount: number,
  reason: string,
): Promise<void> {
  try {
    const tenantUsersSnap = await db
      .collection("users")
      .where("tenantId", "==", tenantId)
      .where("role", "in", ["admin", "master"])
      .limit(1)
      .get();
    const masterUid = tenantUsersSnap.empty ? undefined : tenantUsersSnap.docs[0].id;

    const formattedAmount = amount.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    await db.collection("notifications").add({
      tenantId,
      ...(masterUid ? { userId: masterUid } : {}),
      type: "system",
      title: "Falha ao transferir recebimento para sua conta",
      message: `O valor de R$ ${formattedAmount} não pôde ser transferido para sua chave PIX. Motivo: ${reason}. Verifique as configurações em Configurações > Asaas.`,
      transactionId,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (notifErr) {
    logger.warn("notifyPayoutFailed: could not create notification", {
      tenantId,
      error: notifErr instanceof Error ? notifErr.message : String(notifErr),
    });
  }
}
