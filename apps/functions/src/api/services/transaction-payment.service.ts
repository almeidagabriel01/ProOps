import axios from "axios";
import crypto from "node:crypto";
import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";
import { AsaasService } from "./asaas.service";
import { cpf, cnpj } from "cpf-cnpj-validator";

export class AsaasApiError extends Error {
  constructor(
    public readonly asaasStatus: number,
    public readonly asaasMessage: string,
  ) {
    super(`ASAAS_API_ERROR:${asaasStatus}`);
    this.name = "AsaasApiError";
  }
}

export type PaymentMethod = "pix" | "boleto";

export interface CreatePaymentRequest {
  token: string;
  method: PaymentMethod;
  transactionId?: string;
  payerOverride?: {
    identification?: { type: "CPF" | "CNPJ"; number: string };
    firstName?: string;
    lastName?: string;
    // email NOT exposed (security — email always comes from resolvePayerFromTransaction)
    // address NOT needed for Asaas (boleto does not require address)
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

export interface PaymentStatusResult {
  paymentId: string;
  status: "awaiting" | "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  amount: number;
  paidAt?: string;
}

export type PaymentResult = PixPaymentResult | BoletoPaymentResult;

const SHARED_TRANSACTIONS_COLLECTION = "shared_transactions";
const PAYMENT_ATTEMPTS_COLLECTION = "payment_attempts";

function mapAsaasStatus(
  asaasStatus: string,
): "awaiting" | "pending" | "approved" | "rejected" | "refunded" | "cancelled" {
  switch (asaasStatus) {
    case "RECEIVED":
    case "CONFIRMED":
      return "approved";
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS":
      return "pending";
    case "OVERDUE":
      return "pending";
    case "REFUNDED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
    case "DUNNING_REQUESTED":
    case "DUNNING_RECEIVED":
      return "refunded";
    case "DELETED":
    case "RESTORED":
      return "cancelled";
    default:
      return "awaiting";
  }
}

/** Format a Date as YYYY-MM-DD (local date, no timezone conversion). */
function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const empty = {
    email: null,
    identificationType: null,
    identificationNumber: null,
    firstName: null,
    lastName: null,
  };
  const clientId = txData.clientId as string | undefined;
  if (!clientId) return empty;

  const contactSnap = await db.collection("clients").doc(clientId).get();
  if (!contactSnap.exists) return empty;

  const contact = contactSnap.data() as Record<string, unknown>;
  if (contact.tenantId !== tenantId) return empty;

  const email =
    typeof contact.email === "string" && contact.email.includes("@") ? contact.email : null;
  const docRaw =
    typeof contact.document === "string" ? contact.document.replace(/\D/g, "") : "";
  const identificationType: "CPF" | "CNPJ" | null =
    docRaw.length === 11 ? "CPF" : docRaw.length === 14 ? "CNPJ" : null;
  const identificationNumber = identificationType ? docRaw : null;

  const fullName = typeof contact.name === "string" ? contact.name.trim() : "";
  const parts = fullName.split(/\s+/);
  const firstName = parts[0] || null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  return { email, identificationType, identificationNumber, firstName, lastName };
}

/** Create or find an Asaas customer for the payer. Returns the Asaas customer ID. */
async function resolveAsaasCustomer(
  apiKey: string,
  environment: import("./asaas.service").AsaasEnvironment,
  payer: {
    email: string | null;
    identificationType: "CPF" | "CNPJ" | null;
    identificationNumber: string | null;
    firstName: string | null;
    lastName: string | null;
  },
  attemptId: string,
): Promise<string> {
  const baseUrl = AsaasService.getBaseUrl(environment);
  const headers = { access_token: apiKey, "Content-Type": "application/json" };

  // If CPF/CNPJ is known, search first to avoid duplicates
  if (payer.identificationNumber) {
    try {
      const searchResp = await axios.get<{
        data?: Array<{ id: string }>;
        totalCount?: number;
      }>(
        `${baseUrl}/v3/customers`,
        {
          headers,
          params: { cpfCnpj: payer.identificationNumber, limit: 1 },
        },
      );
      const existing = searchResp.data?.data?.[0];
      if (existing?.id) {
        return existing.id;
      }
    } catch {
      // Search failed — proceed to create
    }
  }

  const fullName = [payer.firstName, payer.lastName].filter(Boolean).join(" ") || "Cliente";

  const customerPayload: Record<string, unknown> = {
    name: fullName,
  };
  if (payer.email) {
    customerPayload.email = payer.email;
  }
  if (payer.identificationNumber) {
    customerPayload.cpfCnpj = payer.identificationNumber;
  }

  try {
    const createResp = await axios.post<{ id: string }>(
      `${baseUrl}/v3/customers`,
      customerPayload,
      { headers },
    );
    return createResp.data.id;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as Record<string, unknown> | undefined;
      const status = error.response?.status ?? 0;
      const errors = Array.isArray(data?.errors)
        ? (data.errors as Array<{ code: string; description: string }>)
        : [];
      const message =
        errors[0]?.description ||
        (typeof data?.message === "string" ? data.message : error.message);
      throw new AsaasApiError(status, message);
    }
    throw error;
  }
}

export class TransactionPaymentService {
  static async createPayment(req: CreatePaymentRequest): Promise<PaymentResult> {
    const sharedLink = await resolveSharedLink(req.token);
    const { tenantId } = sharedLink;
    let transactionId = sharedLink.transactionId;

    // Cross-group transaction check
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
        originData.proposalId && originData.proposalId === candidateData.proposalId;

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

    // Validate method (only pix and boleto supported)
    if (req.method !== "pix" && req.method !== "boleto") {
      throw new Error("INVALID_METHOD");
    }

    const asaasData = await AsaasService.getAsaasData(tenantId);
    if (!asaasData) {
      throw new Error("ASAAS_NOT_CONFIGURED");
    }

    const { apiKey, environment } = asaasData;
    const baseUrl = AsaasService.getBaseUrl(environment);
    const headers = { access_token: apiKey, "Content-Type": "application/json" };

    const attemptId = crypto.randomUUID();
    const attemptRef = db.collection(PAYMENT_ATTEMPTS_COLLECTION).doc(attemptId);
    const now = new Date().toISOString();

    await attemptRef.set({
      tenantId,
      transactionId,
      token: req.token,
      method: req.method,
      status: "initiated",
      gateway: "asaas",
      environment,
      createdAt: now,
    });

    try {
      const rawAmount = Number(txData.amount);
      if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        throw new Error("INVALID_AMOUNT");
      }
      const roundedAmount = Math.round(rawAmount * 100) / 100;

      const payer = await resolvePayerFromTransaction(tenantId, txData);

      // Merge payer with optional override (identification only)
      const mergedIdentificationType =
        payer.identificationType ?? req.payerOverride?.identification?.type ?? null;
      const mergedIdentificationNumber =
        payer.identificationNumber ?? req.payerOverride?.identification?.number ?? null;

      // Validate identification format before making any request
      if (mergedIdentificationNumber) {
        const digits = mergedIdentificationNumber.replace(/\D/g, "");
        const isValidId =
          digits.length === 11
            ? cpf.isValid(digits)
            : digits.length === 14
              ? cnpj.isValid(digits)
              : false;
        if (!isValidId) throw new Error("INVALID_IDENTIFICATION");
      }

      // Boleto requires CPF/CNPJ
      if (req.method === "boleto") {
        if (!mergedIdentificationType || !mergedIdentificationNumber) {
          throw new Error("BOLETO_MISSING_IDENTIFICATION");
        }
      }

      const mergedPayer = {
        email: payer.email,
        identificationType: mergedIdentificationType,
        identificationNumber: mergedIdentificationNumber,
        firstName: payer.firstName ?? req.payerOverride?.firstName ?? null,
        lastName: payer.lastName ?? req.payerOverride?.lastName ?? null,
      };

      // Resolve or create Asaas customer
      const customerId = await resolveAsaasCustomer(apiKey, environment, mergedPayer, attemptId);

      const externalReference = `${transactionId}:${attemptId}`;

      if (req.method === "pix") {
        // PIX dueDate = today (required by Asaas; QR code expires independently)
        const pixDueDate = toDateString(new Date());

        const pixResponse = await axios.post<{
          id: string;
          status: string;
          value: number;
          dueDate: string;
        }>(
          `${baseUrl}/v3/payments`,
          {
            customer: customerId,
            billingType: "PIX",
            value: roundedAmount,
            dueDate: pixDueDate,
            description: (txData.description as string) || "Pagamento via ProOps",
            externalReference,
          },
          { headers },
        );

        const asaasPaymentId = pixResponse.data.id;

        // Fetch PIX QR code
        const qrCodeResponse = await axios.get<{
          encodedImage: string;
          payload?: string;
          expirationDate?: string;
        }>(`${baseUrl}/v3/payments/${asaasPaymentId}/pixQrCode`, { headers });

        const qrCode = qrCodeResponse.data.payload || "";
        const qrCodeBase64 = qrCodeResponse.data.encodedImage || "";
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        await attemptRef.update({
          gatewayPaymentId: asaasPaymentId,
          externalReference,
          status: "created",
        });

        await transactionRef.update({
          "payment.gatewayPaymentId": asaasPaymentId,
          "payment.method": "pix",
          "payment.status": "pending",
          "payment.createdAt": now,
          "payment.gateway": "asaas",
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Persist CPF/CNPJ on client if provided via override and not already set
        const clientId = txData.clientId as string | undefined;
        if (
          clientId &&
          !payer.identificationNumber &&
          mergedIdentificationNumber
        ) {
          db.collection("clients")
            .doc(clientId)
            .set({ document: mergedIdentificationNumber }, { merge: true })
            .catch((persistErr) =>
              logger.warn("Failed to persist client document after PIX", {
                clientId,
                error:
                  persistErr instanceof Error ? persistErr.message : String(persistErr),
              }),
            );
        }

        logger.info("PIX payment created via Asaas", {
          tenantId,
          transactionId,
          asaasPaymentId,
          environment,
        });

        return {
          method: "pix",
          paymentId: asaasPaymentId,
          qrCode,
          qrCodeBase64,
          expiresAt,
          amount: pixResponse.data.value,
        };
      }

      // Boleto
      const boletoDueDays = 3;
      const boletoDueDate = toDateString(
        new Date(Date.now() + boletoDueDays * 24 * 60 * 60 * 1000),
      );

      const boletoResponse = await axios.post<{
        id: string;
        status: string;
        value: number;
        dueDate: string;
        bankSlipUrl?: string;
        invoiceUrl?: string;
      }>(
        `${baseUrl}/v3/payments`,
        {
          customer: customerId,
          billingType: "BOLETO",
          value: roundedAmount,
          dueDate: boletoDueDate,
          description: (txData.description as string) || "Pagamento via ProOps",
          externalReference,
          postalService: false,
        },
        { headers },
      );

      const asaasPaymentId = boletoResponse.data.id;
      const boletoUrl =
        boletoResponse.data.bankSlipUrl || boletoResponse.data.invoiceUrl || "";

      // Fetch linha digitável (identification field)
      let barcodeContent = "";
      try {
        const idFieldResp = await axios.get<{ identificationField?: string }>(
          `${baseUrl}/v3/payments/${asaasPaymentId}/identificationField`,
          { headers },
        );
        barcodeContent = idFieldResp.data.identificationField || "";
      } catch (barcodeErr) {
        logger.warn("Asaas: failed to fetch boleto identification field (best-effort)", {
          tenantId,
          asaasPaymentId,
          error: barcodeErr instanceof Error ? barcodeErr.message : String(barcodeErr),
        });
      }

      await attemptRef.update({
        gatewayPaymentId: asaasPaymentId,
        externalReference,
        status: "created",
      });

      await transactionRef.update({
        "payment.gatewayPaymentId": asaasPaymentId,
        "payment.method": "boleto",
        "payment.status": "pending",
        "payment.createdAt": now,
        "payment.gateway": "asaas",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Persist CPF/CNPJ on client if provided via override and not already set
      const clientId = txData.clientId as string | undefined;
      if (clientId && !payer.identificationNumber && mergedIdentificationNumber) {
        db.collection("clients")
          .doc(clientId)
          .set({ document: mergedIdentificationNumber }, { merge: true })
          .catch((persistErr) =>
            logger.warn("Failed to persist client document after boleto", {
              clientId,
              error:
                persistErr instanceof Error ? persistErr.message : String(persistErr),
            }),
          );
      }

      logger.info("Boleto payment created via Asaas", {
        tenantId,
        transactionId,
        asaasPaymentId,
        environment,
      });

      return {
        method: "boleto",
        paymentId: asaasPaymentId,
        barcodeContent,
        boletoUrl,
        expiresAt: boletoDueDate,
        amount: boletoResponse.data.value,
      };
    } catch (error) {
      await attemptRef.update({ status: "failed" }).catch(() => {
        // best-effort
      });

      if (axios.isAxiosError(error)) {
        const data = error.response?.data as Record<string, unknown> | undefined;
        const status = error.response?.status ?? 0;
        const errors = Array.isArray(data?.errors)
          ? (data.errors as Array<{ code: string; description: string }>)
          : [];
        const message =
          errors[0]?.description ||
          (typeof data?.message === "string" ? data.message : error.message);
        logger.error("Error creating Asaas payment", {
          tenantId,
          transactionId,
          method: req.method,
          asaasStatus: status,
          asaasMessage: message,
        });
        throw new AsaasApiError(status, message);
      }

      logger.error("Error creating Asaas payment (non-API error)", {
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
    const { tenantId } = sharedLink;

    const attemptsSnap = await db
      .collection(PAYMENT_ATTEMPTS_COLLECTION)
      .where("gatewayPaymentId", "==", paymentId)
      .where("tenantId", "==", tenantId)
      .limit(1)
      .get();

    if (attemptsSnap.empty) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    const asaasData = await AsaasService.getAsaasData(tenantId);
    if (!asaasData) {
      throw new Error("ASAAS_NOT_CONFIGURED");
    }

    const { apiKey, environment } = asaasData;
    const baseUrl = AsaasService.getBaseUrl(environment);

    const asaasResponse = await axios.get<{
      id: string;
      status: string;
      value: number;
      paymentDate?: string;
    }>(`${baseUrl}/v3/payments/${paymentId}`, {
      headers: { access_token: apiKey },
    });

    const asaasPayment = asaasResponse.data;
    const status = mapAsaasStatus(asaasPayment.status);

    if (status === "cancelled" || status === "rejected") {
      logger.warn("Asaas payment polling: non-active status", {
        tenantId,
        paymentId,
        asaasRawStatus: asaasPayment.status,
      });
    }

    return {
      paymentId,
      status,
      amount: asaasPayment.value,
      paidAt: asaasPayment.paymentDate || undefined,
    };
  }

  static async simulateSandboxPayment(
    token: string,
    paymentId: string,
  ): Promise<void> {
    const sharedLink = await resolveSharedLink(token);
    const { tenantId } = sharedLink;

    const asaasData = await AsaasService.getAsaasData(tenantId);
    if (!asaasData) {
      throw new Error("ASAAS_NOT_CONFIGURED");
    }
    if (asaasData.environment !== "sandbox") {
      throw new Error("SIMULATE_ONLY_IN_SANDBOX");
    }

    const baseUrl = AsaasService.getBaseUrl(asaasData.environment);

    const attemptsSnap = await db
      .collection(PAYMENT_ATTEMPTS_COLLECTION)
      .where("gatewayPaymentId", "==", paymentId)
      .where("tenantId", "==", tenantId)
      .limit(1)
      .get();

    if (attemptsSnap.empty) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    const attempt = attemptsSnap.docs[0].data() as Record<string, unknown>;
    const transactionSnap = await db
      .collection("transactions")
      .doc(attempt.transactionId as string)
      .get();
    const txData = transactionSnap.data() as Record<string, unknown> | undefined;
    const value = Number(txData?.amount ?? 0);

    try {
      await axios.post(
        `${baseUrl}/v3/payments/${paymentId}/receiveInCash`,
        { value, notifyCustomer: false },
        { headers: { access_token: asaasData.apiKey } },
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as Record<string, unknown> | undefined;
        const errors = Array.isArray(data?.errors)
          ? (data.errors as Array<{ description: string }>)
          : [];
        const message = errors[0]?.description ?? err.message;
        throw new Error(`ASAAS_SIMULATE_FAILED:${message}`);
      }
      throw err;
    }
  }
}
