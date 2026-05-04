import { callApi, callPublicApi } from "@/lib/api-client";

export interface MercadoPagoStatus {
  connected: boolean;
  userId?: string;
  connectedAt?: string;
  liveMode?: boolean;
  environment?: "sandbox" | "production";
}

export const MercadoPagoService = {
  getStatus: (): Promise<MercadoPagoStatus> =>
    callApi<MercadoPagoStatus>("/v1/mercadopago/status", "GET"),

  getOAuthUrl: (): Promise<{ authUrl: string }> =>
    callApi<{ authUrl: string }>("/v1/mercadopago/oauth/start", "GET"),

  processCallback: (code: string, state: string): Promise<{ success: boolean }> =>
    callApi<{ success: boolean }>("/v1/mercadopago/oauth/callback", "POST", { code, state }),

  disconnect: (): Promise<{ success: boolean }> =>
    callApi<{ success: boolean }>("/v1/mercadopago/disconnect", "DELETE"),
};

export type PaymentMethod = "pix" | "credit_card" | "debit_card" | "boleto";

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

export type PaymentResult = PixPaymentResult | BoletoPaymentResult | CheckoutProResult;

export interface PaymentStatusResult {
  paymentId: string;
  status: "awaiting" | "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  amount: number;
  paidAt?: string;
}

export interface MpPublicConfig {
  publicKey: string;
  environment: "sandbox" | "production";
  sellerTestEmail?: string;
}

export interface CardPaymentFormData {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
  transaction_amount: number;
  payer: {
    email: string;
    identification?: { type: string; number: string };
  };
}

export interface ProcessCardInput {
  cardToken: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  payerEmail: string;
  payerIdentification?: { type: string; number: string };
  transactionId?: string;
}

export interface CardPaymentResult {
  paymentId: string;
  status: "approved" | "rejected" | "pending" | "in_process";
  statusDetail?: string;
  amount: number;
}

export interface PayerOverride {
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
}

export const PublicPaymentService = {
  createPayment: (
    token: string,
    method: PaymentMethod,
    options?: { installments?: number; backUrl?: string; transactionId?: string; payerOverride?: PayerOverride },
  ): Promise<PaymentResult> =>
    callPublicApi<PaymentResult>(`/v1/share/transaction/${token}/payment`, "POST", {
      method,
      ...options,
    }),

  getPaymentStatus: (token: string, paymentId: string): Promise<PaymentStatusResult> =>
    callPublicApi<PaymentStatusResult>(
      `/v1/share/transaction/${token}/payment/${paymentId}/status`,
      "GET",
    ),

  getMpConfig: (token: string): Promise<MpPublicConfig> =>
    callPublicApi<MpPublicConfig>(`/v1/share/transaction/${token}/mp-config`, "GET"),

  processCardPayment: (token: string, input: ProcessCardInput): Promise<CardPaymentResult> =>
    callPublicApi<CardPaymentResult>(
      `/v1/share/transaction/${token}/process-card`,
      "POST",
      input,
    ),
};
