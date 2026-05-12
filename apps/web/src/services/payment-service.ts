import { callApi, callPublicApi } from "@/lib/api-client";

export type PaymentMethod = "pix" | "boleto";

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

export type PaymentResult = PixPaymentResult | BoletoPaymentResult;

export interface PaymentConfig {
  gateway: "asaas";
  environment: "sandbox" | "production";
}

export interface PaymentStatus {
  paymentId: string;
  status: "awaiting" | "pending" | "approved" | "rejected" | "refunded" | "cancelled";
  amount: number;
  paidAt?: string;
}

export interface AsaasConnectionStatus {
  connected: boolean;
  environment?: "sandbox" | "production";
  connectedAt?: string;
}

export interface AsaasOnboardingData {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone: string;
  companyType?: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  province: string;
}

export interface PayerOverride {
  identification?: { type: "CPF" | "CNPJ"; number: string };
  firstName?: string;
  lastName?: string;
}

export const PaymentService = {
  createPayment: (
    token: string,
    method: PaymentMethod,
    options?: { transactionId?: string; payerOverride?: PayerOverride },
  ): Promise<PaymentResult> =>
    callPublicApi<PaymentResult>(`/v1/share/transaction/${token}/payment`, "POST", {
      method,
      ...options,
    }),

  getPaymentStatus: (token: string, paymentId: string): Promise<PaymentStatus> =>
    callPublicApi<PaymentStatus>(
      `/v1/share/transaction/${token}/payment/${paymentId}/status`,
      "GET",
    ),

  getPaymentConfig: (token: string): Promise<PaymentConfig> =>
    callPublicApi<PaymentConfig>(`/v1/share/transaction/${token}/payment-config`, "GET"),
};

export const AsaasService = {
  getStatus: (): Promise<AsaasConnectionStatus> =>
    callApi<AsaasConnectionStatus>("/v1/asaas/status", "GET"),

  connect: (data: AsaasOnboardingData): Promise<{ success: boolean }> =>
    callApi<{ success: boolean }>("/v1/asaas/connect", "POST", data),

  disconnect: (): Promise<{ success: boolean }> =>
    callApi<{ success: boolean }>("/v1/asaas/disconnect", "DELETE"),
};
