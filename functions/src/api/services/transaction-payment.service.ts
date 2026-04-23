import axios from "axios";
import crypto from "node:crypto";
import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import { MercadoPagoService } from "./mercadopago.service";
import { resolveFrontendAppOrigin, resolveMercadoPagoWebhookUrl } from "../../lib/frontend-app-url";

export class MercadoPagoApiError extends Error {
  constructor(
    public readonly mpStatus: number,
    public readonly mpMessage: string,
    public readonly mpCause: Array<{ code: string; description: string }>,
  ) {
    super(`MP_API_ERROR:${mpStatus}`);
    this.name = "MercadoPagoApiError";
  }
}

export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "boleto";

export interface CreatePaymentRequest {
  token: string;
  method: PaymentMethod;
  installments?: number;
  backUrl?: string;
  transactionId?: string;
}

export interface PixPaymentResult {
  method: "pix";
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  amount: number;
}

export interface CheckoutProResult {
  method: "credit_card" | "debit_card" | "boleto";
  paymentId: string;
  initPoint: string;
  amount: number;
}

export interface PaymentStatusResult {
  paymentId: string;
  status: "awaiting" | "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  amount: number;
  paidAt?: string;
}

export type PaymentResult = PixPaymentResult | CheckoutProResult;

const SHARED_TRANSACTIONS_COLLECTION = "shared_transactions";
const PAYMENT_ATTEMPTS_COLLECTION = "payment_attempts";
const MP_API_BASE = "https://api.mercadopago.com";

function mapMpStatus(
  mpStatus: string,
): "awaiting" | "pending" | "approved" | "rejected" | "refunded" | "cancelled" {
  switch (mpStatus) {
    case "approved":
      return "approved";
    case "pending":
      return "pending";
    case "in_process":
      return "pending";
    case "rejected":
      return "rejected";
    case "refunded":
      return "refunded";
    case "cancelled":
      return "cancelled";
    default:
      return "awaiting";
  }
}

async function resolveSharedLink(token: string): Promise<{
  id: string;
  transactionId: string;
  tenantId: string;
  expiresAt: string | null;
}> {
  const snapshot = await db
    .collection(SHARED_TRANSACTIONS_COLLECTION)
    .where("token", "==", token)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error("EXPIRED_LINK");
  }

  const doc = snapshot.docs[0];
  const data = doc.data() as {
    transactionId: string;
    tenantId: string;
    expiresAt: string | null;
  };

  if (data.expiresAt !== null && new Date(data.expiresAt) < new Date()) {
    throw new Error("EXPIRED_LINK");
  }

  return {
    id: doc.id,
    transactionId: data.transactionId,
    tenantId: data.tenantId,
    expiresAt: data.expiresAt,
  };
}

async function resolvePayerFromTransaction(
  tenantId: string,
  txData: Record<string, unknown>,
): Promise<{
  email: string | null;
  identificationType: "CPF" | "CNPJ" | null;
  identificationNumber: string | null;
  firstName: string | null;
  lastName: string | null;
}> {
  const empty = { email: null, identificationType: null, identificationNumber: null, firstName: null, lastName: null };
  const clientId = txData.clientId as string | undefined;
  if (!clientId) return empty;

  const contactSnap = await db.collection("clients").doc(clientId).get();
  if (!contactSnap.exists) return empty;

  const contact = contactSnap.data() as Record<string, unknown>;
  if (contact.tenantId !== tenantId) return empty;

  const email = typeof contact.email === "string" && contact.email.includes("@") ? contact.email : null;
  const docRaw = typeof contact.document === "string" ? contact.document.replace(/\D/g, "") : "";
  const identificationType: "CPF" | "CNPJ" | null = docRaw.length === 11 ? "CPF" : docRaw.length === 14 ? "CNPJ" : null;
  const identificationNumber = identificationType ? docRaw : null;

  const fullName = typeof contact.name === "string" ? contact.name.trim() : "";
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  return { email, identificationType, identificationNumber, firstName, lastName };
}

export class TransactionPaymentService {
  static async createPayment(req: CreatePaymentRequest): Promise<PaymentResult> {
    const sharedLink = await resolveSharedLink(req.token);
    const { tenantId } = sharedLink;
    let transactionId = sharedLink.transactionId;

    if (req.transactionId && req.transactionId !== sharedLink.transactionId) {
      const [originSnap, candidateSnap] = await Promise.all([
        db.collection("transactions").doc(sharedLink.transactionId).get(),
        db.collection("transactions").doc(req.transactionId).get(),
      ]);
      if (!originSnap.exists || !candidateSnap.exists) {
        throw new Error("TRANSACTION_NOT_FOUND");
      }
      const originData = originSnap.data() as Record<string, unknown>;
      const candidateData = candidateSnap.data() as Record<string, unknown>;
      if (candidateData.tenantId !== tenantId) {
        throw new Error("FORBIDDEN_TENANT_MISMATCH");
      }

      const sameInstallmentGroup =
        originData.installmentGroupId &&
        originData.installmentGroupId === candidateData.installmentGroupId;
      const sameProposalGroup =
        originData.proposalGroupId &&
        originData.proposalGroupId === candidateData.proposalGroupId;
      const sameProposalId =
        originData.proposalId &&
        originData.proposalId === candidateData.proposalId;

      if (!sameInstallmentGroup && !sameProposalGroup && !sameProposalId) {
        logger.warn("Cross-transaction payment rejected: not in same group", {
          tenantId,
          originTxId: sharedLink.transactionId,
          candidateTxId: req.transactionId,
        });
        throw new Error("FORBIDDEN_CROSS_GROUP");
      }
      transactionId = req.transactionId;
    }

    const transactionRef = db.collection("transactions").doc(transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      throw new Error("EXPIRED_LINK");
    }

    const txData = transactionSnap.data() as Record<string, unknown>;

    if (txData.status !== "pending" && txData.status !== "overdue") {
      throw new Error("ALREADY_PAID");
    }

    const mpData = await MercadoPagoService.getMercadoPagoData(tenantId);
    if (!mpData) {
      throw new Error("MP_NOT_CONFIGURED");
    }

    const { accessToken, liveMode } = mpData;
    const attemptId = crypto.randomUUID();
    const attemptRef = db.collection(PAYMENT_ATTEMPTS_COLLECTION).doc(attemptId);
    const now = new Date().toISOString();

    await attemptRef.set({
      tenantId,
      transactionId,
      token: req.token,
      method: req.method,
      status: "initiated",
      createdAt: now,
      ipAnon: null,
    });

    try {
      if (req.method === "pix") {
        const rawAmount = Number(txData.amount);
        if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
          throw new Error("INVALID_AMOUNT");
        }
        const roundedAmount = Math.round(rawAmount * 100) / 100;

        const payer = await resolvePayerFromTransaction(tenantId, txData);
        const payerPayload: Record<string, unknown> = {
          email: payer.email || `payment+${attemptId}@proops.com.br`,
        };
        if (payer.firstName) payerPayload.first_name = payer.firstName;
        if (payer.lastName) payerPayload.last_name = payer.lastName;
        if (payer.identificationType && payer.identificationNumber) {
          payerPayload.identification = {
            type: payer.identificationType,
            number: payer.identificationNumber,
          };
        }

        const pixResponse = await axios.post<{
          id: number;
          point_of_interaction: {
            transaction_data: {
              qr_code: string;
              qr_code_base64: string;
            };
          };
          date_of_expiration: string;
          transaction_amount: number;
        }>(
          `${MP_API_BASE}/v1/payments`,
          {
            transaction_amount: roundedAmount,
            payment_method_id: "pix",
            payer: payerPayload,
            description: (txData.description as string) || "Pagamento via ProOps",
            installments: 1,
            external_reference: `${transactionId}:${attemptId}`,
            notification_url: resolveMercadoPagoWebhookUrl(),
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": attemptId,
            },
          },
        );

        const mpPaymentId = String(pixResponse.data.id);

        await attemptRef.update({
          mpPaymentId,
          status: "created",
        });

        await transactionRef.update({
          "payment.mpPaymentId": mpPaymentId,
          "payment.method": "pix",
          "payment.status": "pending",
          "payment.createdAt": now,
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info("PIX payment created", { tenantId, transactionId, mpPaymentId });

        return {
          method: "pix",
          paymentId: mpPaymentId,
          qrCode: pixResponse.data.point_of_interaction.transaction_data.qr_code,
          qrCodeBase64: pixResponse.data.point_of_interaction.transaction_data.qr_code_base64,
          expiresAt: pixResponse.data.date_of_expiration,
          amount: pixResponse.data.transaction_amount,
        };
      }

      // credit_card | debit_card | boleto → Checkout Pro preference
      const payer = await resolvePayerFromTransaction(tenantId, txData);
      const appOrigin = resolveFrontendAppOrigin();
      const fallbackBackUrl = `${appOrigin}/share/transaction/${req.token}`;
      const isLocalhostUrl = req.backUrl && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(req.backUrl);
      const effectiveBackUrl = isLocalhostUrl ? undefined : req.backUrl;
      const successUrl = effectiveBackUrl || `${fallbackBackUrl}?payment_success=1`;
      const failureUrl = effectiveBackUrl || fallbackBackUrl;
      const pendingUrl = effectiveBackUrl || fallbackBackUrl;

      const payerBlock: Record<string, unknown> = {};
      if (payer.email) payerBlock.email = payer.email;
      if (payer.firstName) payerBlock.name = payer.firstName;
      if (payer.lastName) payerBlock.surname = payer.lastName;
      if (payer.identificationType && payer.identificationNumber) {
        payerBlock.identification = {
          type: payer.identificationType,
          number: payer.identificationNumber,
        };
      }

      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      const tenantName = (tenantSnap.data()?.name as string) || "ProOps";
      const statementDescriptor = tenantName.slice(0, 22);

      const paymentMethodsConfig: Record<string, unknown> = {
        installments: req.method === "boleto" ? 1 : (req.installments || 12),
      };
      if (req.method === "boleto") {
        paymentMethodsConfig.excluded_payment_types = [
          { id: "credit_card" }, { id: "debit_card" },
        ];
      } else if (req.method === "credit_card") {
        paymentMethodsConfig.excluded_payment_types = [
          { id: "ticket" }, { id: "bank_transfer" },
        ];
      }

      const preferenceResponse = await axios.post<{
        id: string;
        init_point: string;
        sandbox_init_point: string;
      }>(
        `${MP_API_BASE}/checkout/preferences`,
        {
          items: [
            {
              id: transactionId,
              title: (txData.description as string) || "Pagamento",
              quantity: 1,
              unit_price: txData.amount as number,
              currency_id: "BRL",
            },
          ],
          payer: Object.keys(payerBlock).length > 0 ? payerBlock : undefined,
          back_urls: { success: successUrl, failure: failureUrl, pending: pendingUrl },
          auto_return: "approved",
          payment_methods: paymentMethodsConfig,
          external_reference: `${transactionId}:${attemptId}`,
          notification_url: resolveMercadoPagoWebhookUrl(),
          statement_descriptor: statementDescriptor,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      const preferenceId = preferenceResponse.data.id;

      await attemptRef.update({
        mpPaymentId: preferenceId,
        status: "created",
      });

      await transactionRef.update({
        "payment.mpPreferenceId": preferenceId,
        "payment.method": req.method,
        "payment.status": "pending",
        "payment.createdAt": now,
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Checkout Pro preference created", {
        tenantId,
        transactionId,
        preferenceId,
        method: req.method,
      });

      return {
        method: req.method as "credit_card" | "debit_card" | "boleto",
        paymentId: preferenceId,
        initPoint: liveMode ? preferenceResponse.data.init_point : preferenceResponse.data.sandbox_init_point,
        amount: txData.amount as number,
      };
    } catch (error) {
      await attemptRef.update({ status: "failed" }).catch(() => {
        // best-effort
      });

      if (axios.isAxiosError(error)) {
        const data = error.response?.data as Record<string, unknown> | undefined;
        const mpStatus = error.response?.status ?? 0;
        const mpMessage = typeof data?.message === "string" ? data.message : error.message;
        const mpCause = Array.isArray(data?.cause)
          ? (data.cause as Array<{ code: string; description: string }>)
          : [];
        logger.error("Error creating MP payment", {
          tenantId,
          transactionId,
          method: req.method,
          mpStatus,
          mpMessage,
          mpCause,
        });
        throw new MercadoPagoApiError(mpStatus, mpMessage, mpCause);
      }

      logger.error("Error creating MP payment (non-MP error)", {
        tenantId,
        transactionId,
        method: req.method,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  static async getPaymentStatus(
    token: string,
    paymentId: string,
  ): Promise<PaymentStatusResult> {
    const sharedLink = await resolveSharedLink(token);
    const { transactionId, tenantId } = sharedLink;

    const attemptsSnap = await db
      .collection(PAYMENT_ATTEMPTS_COLLECTION)
      .where("mpPaymentId", "==", paymentId)
      .where("transactionId", "==", transactionId)
      .limit(1)
      .get();

    if (attemptsSnap.empty) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    const mpData = await MercadoPagoService.getMercadoPagoData(tenantId);
    if (!mpData) {
      throw new Error("MP_NOT_CONFIGURED");
    }

    const mpResponse = await axios.get<{
      id: number;
      status: string;
      transaction_amount: number;
      date_approved?: string;
    }>(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpData.accessToken}` },
    });

    const mpPayment = mpResponse.data;
    const status = mapMpStatus(mpPayment.status);

    return {
      paymentId,
      status,
      amount: mpPayment.transaction_amount,
      paidAt: mpPayment.date_approved || undefined,
    };
  }
}
