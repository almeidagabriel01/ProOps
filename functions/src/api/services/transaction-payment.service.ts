import axios from "axios";
import crypto from "node:crypto";
import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import { MercadoPagoService } from "./mercadopago.service";
import { resolveWalletRef } from "../../lib/finance-helpers";
import { resolveFrontendAppOrigin, resolveMercadoPagoWebhookUrl } from "../../lib/frontend-app-url";
import { cpf, cnpj } from "cpf-cnpj-validator";

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
  payerOverride?: {
    identification?: { type: "CPF" | "CNPJ"; number: string };
    firstName?: string;
    lastName?: string;
    address?: {
      zipCode: string;
      streetName: string;
      streetNumber: string;
      neighborhood: string;
      city: string;
      federalUnit: string;
    };
    // email NOT exposed (security — email always comes from resolvePayerFromTransaction)
  };
}

export interface PixPaymentResult {
  method: "pix";
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  amount: number;
}

export interface BoletoPaymentResult {
  method: "boleto";
  paymentId: string;
  barcodeContent: string;
  boletoUrl: string;
  expiresAt: string;
  amount: number;
}

export interface CheckoutProResult {
  method: "credit_card" | "debit_card";
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

export type PaymentResult = PixPaymentResult | BoletoPaymentResult | CheckoutProResult;

export interface ProcessCardPaymentRequest {
  token: string;
  transactionId?: string;
  cardToken: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  payerEmail: string;
  payerIdentification?: { type: "CPF" | "CNPJ"; number: string };
}

export interface CardDirectPaymentResult {
  paymentId: string;
  status: string;
  statusDetail?: string;
  amount: number;
}

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

    const { accessToken, environment, liveMode } = mpData;
    const effectiveEnvironment = environment ?? (liveMode ? "production" : "sandbox");
    const sandboxAccessToken = process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN;
    const effectiveAccessToken =
      effectiveEnvironment === "sandbox" && sandboxAccessToken
        ? sandboxAccessToken
        : accessToken;
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
      environment: effectiveEnvironment,
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
            date_of_expiration: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          },
          {
            headers: {
              Authorization: `Bearer ${effectiveAccessToken}`,
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

      if (req.method === "boleto") {
        const rawAmount = Number(txData.amount);
        if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
          throw new Error("INVALID_AMOUNT");
        }
        const roundedAmount = Math.round(rawAmount * 100) / 100;

        const payer = await resolvePayerFromTransaction(tenantId, txData);

        // Merge contact data with optional payerOverride from the request.
        // email ALWAYS comes from the contact — never from the override (security).
        const merged = {
          email: payer.email,
          firstName: payer.firstName ?? req.payerOverride?.firstName ?? null,
          lastName: payer.lastName ?? req.payerOverride?.lastName ?? null,
          identificationType: payer.identificationType ?? req.payerOverride?.identification?.type ?? null,
          identificationNumber: payer.identificationNumber ?? req.payerOverride?.identification?.number ?? null,
          address: req.payerOverride?.address ?? null,
        };

        // Validate identification format before making the MP request.
        if (merged.identificationNumber) {
          const digits = merged.identificationNumber.replace(/\D/g, "");
          const isValidId = digits.length === 11
            ? cpf.isValid(digits)
            : digits.length === 14
              ? cnpj.isValid(digits)
              : false;
          if (!isValidId) throw new Error("INVALID_IDENTIFICATION");
        }

        // Boleto requires CPF/CNPJ — reject with a clear error if still missing after merge.
        if (!merged.identificationType || !merged.identificationNumber) {
          throw new Error("BOLETO_MISSING_IDENTIFICATION");
        }

        if (!merged.address) {
          throw new Error("BOLETO_MISSING_ADDRESS");
        }

        const payerPayload: Record<string, unknown> = {
          email: merged.email || `payment+${attemptId}@proops.com.br`,
          first_name: merged.firstName || "Cliente",
          last_name: merged.lastName || "ProOps",
          identification: {
            type: merged.identificationType,
            number: merged.identificationNumber,
          },
          address: {
            zip_code: merged.address.zipCode.replace(/\D/g, ""),
            street_name: merged.address.streetName,
            street_number: merged.address.streetNumber,
            neighborhood: merged.address.neighborhood,
            city: merged.address.city,
            federal_unit: merged.address.federalUnit,
          },
        };

        const boletoExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        const boletoResponse = await axios.post<{
          id: number;
          transaction_amount: number;
          date_of_expiration: string;
          barcode?: { content?: string };
          point_of_interaction?: {
            transaction_data?: {
              boleto_url?: string;
            };
          };
        }>(
          `${MP_API_BASE}/v1/payments`,
          {
            transaction_amount: roundedAmount,
            payment_method_id: "bolbradesco",
            payer: payerPayload,
            description: (txData.description as string) || "Pagamento via ProOps",
            external_reference: `${transactionId}:${attemptId}`,
            notification_url: resolveMercadoPagoWebhookUrl(),
            date_of_expiration: boletoExpiresAt,
          },
          {
            headers: {
              Authorization: `Bearer ${effectiveAccessToken}`,
              "Content-Type": "application/json",
              "X-Idempotency-Key": attemptId,
            },
          },
        );

        const mpPaymentId = String(boletoResponse.data.id);
        const barcodeContent = boletoResponse.data.barcode?.content ?? "";
        const boletoUrl = boletoResponse.data.point_of_interaction?.transaction_data?.boleto_url ?? "";

        await attemptRef.update({
          mpPaymentId,
          status: "created",
        });

        await transactionRef.update({
          "payment.mpPaymentId": mpPaymentId,
          "payment.method": "boleto",
          "payment.status": "pending",
          "payment.createdAt": now,
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Persist CPF/CNPJ on the client document best-effort (if it was provided
        // via payerOverride and the contact didn't have one yet).
        const clientId = txData.clientId as string | undefined;
        if (clientId && !payer.identificationNumber && merged.identificationNumber) {
          db.collection("clients").doc(clientId).set(
            { document: merged.identificationNumber },
            { merge: true },
          ).catch((persistErr) => logger.warn("Failed to persist client document after boleto", {
            clientId,
            error: persistErr instanceof Error ? persistErr.message : String(persistErr),
          }));
        }

        logger.info("Boleto payment created", { tenantId, transactionId, mpPaymentId });

        return {
          method: "boleto",
          paymentId: mpPaymentId,
          barcodeContent,
          boletoUrl,
          expiresAt: boletoResponse.data.date_of_expiration || boletoExpiresAt,
          amount: boletoResponse.data.transaction_amount,
        };
      }

      // credit_card | debit_card → Checkout Pro preference
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
        installments: req.installments || 12,
      };
      if (req.method === "credit_card") {
        paymentMethodsConfig.excluded_payment_types = [
          { id: "ticket" }, { id: "bank_transfer" },
        ];
      }

      const preferenceResponse = await axios.post<{
        id: string;
        init_point: string;
        sandbox_init_point: string;
        live_mode: boolean;
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
      // live_mode may not be present in all MP preference creation responses; guard against undefined
      const preferenceIsLive: boolean | undefined = preferenceResponse.data.live_mode;
      if (preferenceIsLive !== undefined) {
        const resolvedEnvironment = preferenceIsLive ? "production" : "sandbox";
        // Correct stored environment if MP's preference live_mode disagrees (happens with OAuth test users)
        if (resolvedEnvironment !== effectiveEnvironment) {
          logger.warn("MP preference live_mode disagrees with stored environment — correcting", {
            tenantId, stored: effectiveEnvironment, fromPreference: resolvedEnvironment,
          });
          await db.collection("tenants").doc(tenantId).update({
            "mercadoPago.environment": resolvedEnvironment,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

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
        environment: effectiveEnvironment,
      });

      const initPoint = effectiveEnvironment === "sandbox"
        ? preferenceResponse.data.sandbox_init_point
        : preferenceResponse.data.init_point;

      return {
        method: req.method as "credit_card" | "debit_card",
        paymentId: preferenceId,
        initPoint,
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

  static async processCardPayment(
    req: ProcessCardPaymentRequest,
  ): Promise<CardDirectPaymentResult> {
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
        logger.warn("Cross-transaction card payment rejected: not in same group", {
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
    if (!transactionSnap.exists) throw new Error("TRANSACTION_NOT_FOUND");

    const txData = transactionSnap.data() as Record<string, unknown>;
    if (txData.status !== "pending" && txData.status !== "overdue") {
      throw new Error("ALREADY_PAID");
    }

    const rawAmount = Number(txData.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) throw new Error("INVALID_AMOUNT");
    const roundedAmount = Math.round(rawAmount * 100) / 100;

    const [mpData, tenantSnap] = await Promise.all([
      MercadoPagoService.getMercadoPagoData(tenantId),
      db.collection("tenants").doc(tenantId).get(),
    ]);
    if (!mpData) throw new Error("MP_NOT_CONFIGURED");
    const effectiveEnvironment: string =
      mpData.environment ?? (mpData.liveMode ? "production" : "sandbox");

    // In sandbox, both the card token and the payment must be in the same MP context.
    // The card token is created with MERCADOPAGO_SANDBOX_PUBLIC_KEY (integrator's test key),
    // so the payment must also use the integrator's test access token.
    // In production, the seller's OAuth credentials are used directly.
    const sandboxAccessToken = process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN;
    const accessToken =
      effectiveEnvironment === "sandbox" && sandboxAccessToken
        ? sandboxAccessToken
        : mpData.accessToken;

    const statementDescriptor = ((tenantSnap.data()?.name as string) || "ProOps").slice(0, 22);

    const attemptId = crypto.randomUUID();
    const attemptRef = db.collection(PAYMENT_ATTEMPTS_COLLECTION).doc(attemptId);
    const now = new Date().toISOString();

    await attemptRef.set({
      tenantId,
      transactionId,
      token: req.token,
      method: "credit_card",
      status: "initiated",
      createdAt: now,
      ipAnon: null,
      environment: effectiveEnvironment,
    });

    try {
      const payerBlock: Record<string, unknown> = {
        email: req.payerEmail,
      };
      if (req.payerIdentification) {
        payerBlock.identification = {
          type: req.payerIdentification.type,
          number: req.payerIdentification.number,
        };
      }

      const paymentResponse = await axios.post<{
        id: number;
        status: string;
        status_detail?: string;
        transaction_amount: number;
      }>(
        `${MP_API_BASE}/v1/payments`,
        {
          token: req.cardToken,
          transaction_amount: roundedAmount,
          installments: req.installments,
          payment_method_id: req.paymentMethodId,
          ...(req.issuerId && { issuer_id: req.issuerId }),
          payer: payerBlock,
          description: (txData.description as string) || "Pagamento via ProOps",
          external_reference: `${transactionId}:${attemptId}`,
          notification_url: resolveMercadoPagoWebhookUrl(),
          statement_descriptor: statementDescriptor,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": attemptId,
          },
        },
      );

      const mpPaymentId = String(paymentResponse.data.id);
      const mpStatus = paymentResponse.data.status;
      const mpStatusDetail = paymentResponse.data.status_detail;
      const paidAt = new Date().toISOString();

      await attemptRef.update({
        mpPaymentId,
        status: mapMpStatus(mpStatus),
      });

      if (mpStatus === "approved") {
        // Card payments are synchronous and final. Mark the transaction as paid
        // immediately instead of waiting for the webhook, which may not fire in
        // sandbox or on preview deployments.
        await db.runTransaction(async (firestoreTxn) => {
          const freshSnap = await firestoreTxn.get(transactionRef);
          if (!freshSnap.exists) return;
          const freshData = freshSnap.data() as Record<string, unknown>;
          if (freshData.status === "paid") return; // idempotent

          const oldStatus = freshData.status as string;
          const txType = typeof freshData.type === "string" ? freshData.type : null;
          const walletSign = txType === "income" ? 1 : -1;
          const txWallet = typeof freshData.wallet === "string" ? freshData.wallet : null;

          const walletDeltas = new Map<string, number>();
          if (txWallet) {
            walletDeltas.set(txWallet, (walletDeltas.get(txWallet) ?? 0) + walletSign * roundedAmount);
          }

          const extraCosts = Array.isArray(freshData.extraCosts)
            ? (freshData.extraCosts as Array<Record<string, unknown>>)
            : [];
          const syncedExtraCosts = extraCosts.map((ec) => {
            if (ec.status === oldStatus) {
              const ecWallet = typeof ec.wallet === "string" ? ec.wallet : txWallet;
              const ecAmount = typeof ec.amount === "number" ? ec.amount : 0;
              if (ecWallet && ecAmount > 0) {
                walletDeltas.set(ecWallet, (walletDeltas.get(ecWallet) ?? 0) + walletSign * ecAmount);
              }
              return { ...ec, status: "paid" };
            }
            return ec;
          });

          for (const [walletId, delta] of walletDeltas) {
            if (delta === 0) continue;
            const walletResult = await resolveWalletRef(firestoreTxn, db, tenantId, walletId);
            if (walletResult) {
              firestoreTxn.update(walletResult.ref, {
                balance: FieldValue.increment(delta),
              });
            } else {
              logger.warn("Card payment: wallet not found for balance update", { tenantId, walletId });
            }
          }

          const txUpdates: Record<string, unknown> = {
            status: "paid",
            paidAt,
            "payment.mpPaymentId": mpPaymentId,
            "payment.method": "credit_card",
            "payment.status": mpStatus,
            "payment.statusDetail": mpStatusDetail ?? null,
            "payment.createdAt": now,
            updatedAt: FieldValue.serverTimestamp(),
          };
          if (extraCosts.length > 0) {
            txUpdates.extraCosts = syncedExtraCosts;
          }
          firestoreTxn.update(transactionRef, txUpdates);
        });
      } else {
        await transactionRef.update({
          "payment.mpPaymentId": mpPaymentId,
          "payment.method": "credit_card",
          "payment.status": mpStatus,
          "payment.statusDetail": mpStatusDetail ?? null,
          "payment.createdAt": now,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      logger.info("Card direct payment processed", {
        tenantId,
        transactionId,
        mpPaymentId,
        status: mpStatus,
        statusDetail: mpStatusDetail,
        markedAsPaid: mpStatus === "approved",
      });

      return {
        paymentId: mpPaymentId,
        status: mapMpStatus(mpStatus),
        statusDetail: mpStatusDetail,
        amount: roundedAmount,
      };
    } catch (error) {
      await attemptRef.update({ status: "failed" }).catch(() => {});

      if (axios.isAxiosError(error)) {
        const data = error.response?.data as Record<string, unknown> | undefined;
        const mpStatus = error.response?.status ?? 0;
        const mpMessage = typeof data?.message === "string" ? data.message : error.message;
        const mpCause = Array.isArray(data?.cause)
          ? (data.cause as Array<{ code: string; description: string }>)
          : [];
        logger.error("Error processing card payment", {
          tenantId,
          transactionId,
          mpStatus,
          mpMessage,
          mpCause,
        });
        throw new MercadoPagoApiError(mpStatus, mpMessage, mpCause);
      }

      logger.error("Error processing card payment (non-MP error)", {
        tenantId,
        transactionId,
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

    const attemptDoc = attemptsSnap.docs[0];

    const mpData = await MercadoPagoService.getMercadoPagoData(tenantId);
    if (!mpData) {
      throw new Error("MP_NOT_CONFIGURED");
    }

    const sandboxAccessToken = process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN;
    const attemptEnvironment = (attemptDoc.data() as { environment?: string }).environment;
    const effectiveAccessToken =
      attemptEnvironment === "sandbox" && sandboxAccessToken
        ? sandboxAccessToken
        : mpData.accessToken;

    const mpResponse = await axios.get<{
      id: number;
      status: string;
      transaction_amount: number;
      date_approved?: string;
    }>(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${effectiveAccessToken}` },
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
