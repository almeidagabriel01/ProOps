import { callApi, callPublicApi } from "@/lib/api-client";

export interface MercadoPagoStatus {
  connected: boolean;
  userId?: string;
  connectedAt?: string;
  liveMode?: boolean;
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

export interface CheckoutProResult {
  method: "credit_card" | "debit_card" | "boleto";
  paymentId: string;
  initPoint: string;
  amount: number;
}

export type PaymentResult = PixPaymentResult | CheckoutProResult;

export interface PaymentStatusResult {
  paymentId: string;
  status: "awaiting" | "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  amount: number;
  paidAt?: string;
}

export const PublicPaymentService = {
  createPayment: (
    token: string,
    method: PaymentMethod,
    options?: { installments?: number; backUrl?: string; transactionId?: string },
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
};
