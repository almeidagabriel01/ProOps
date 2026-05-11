"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { initMercadoPago } from "@mercadopago/sdk-react";
import type { CardPaymentFormData } from "@/services/mercadopago-service";

const CardPayment = dynamic(
  () => import("@mercadopago/sdk-react").then((m) => m.CardPayment),
  { ssr: false },
);

interface CardPaymentBrickProps {
  publicKey: string;
  amount: number;
  payerEmail?: string;
  onSubmit: (formData: CardPaymentFormData) => Promise<void>;
  onError?: (error: unknown) => void;
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function CardPaymentBrick({
  publicKey,
  amount,
  payerEmail,
  onSubmit,
  onError,
}: CardPaymentBrickProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initMercadoPago(publicKey, { locale: "pt-BR" });
      initialized.current = true;
    }
  }, [publicKey]);

  return (
    <CardPayment
      initialization={{ amount, ...(payerEmail ? { payer: { email: payerEmail } } : {}) }}
      customization={{
        paymentMethods: { maxInstallments: 12, minInstallments: 1 },
        visual: { style: { theme: "default" }, texts: { formSubmit: `Pagar ${formatBRL(amount)}` } },
      }}
      onSubmit={async (sdkFormData) => {
        await onSubmit(sdkFormData as unknown as CardPaymentFormData);
      }}
      onError={onError}
    />
  );
}
