"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "@/lib/toast";
import { Copy, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPaymentService } from "@/services/mercadopago-service";
import { Loader } from "@/components/ui/loader";

interface PixQrCodeViewProps {
  token: string;
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  amount: number;
  expiresAt: string;
  onPaymentApproved: () => void;
  primaryColor?: string;
}

function useCountdown(expiresAt: string) {
  const [remaining, setRemaining] = React.useState<number>(() => {
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  React.useEffect(() => {
    if (remaining <= 0) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isExpired = remaining === 0;

  return { minutes, seconds, isExpired, remaining };
}

export function PixQrCodeView({
  token,
  paymentId,
  qrCode,
  qrCodeBase64,
  expiresAt,
  onPaymentApproved,
  primaryColor,
}: PixQrCodeViewProps) {
  const [copied, setCopied] = React.useState(false);
  const [paymentStatus, setPaymentStatus] = React.useState<
    "polling" | "approved" | "rejected" | "expired"
  >("polling");
  const pollingRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const { minutes, seconds, isExpired } = useCountdown(expiresAt);

  const consecutiveErrorsRef = React.useRef(0);

  const stopPolling = React.useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (isExpired) {
      stopPolling();
      setPaymentStatus("expired");
    }
  }, [isExpired, stopPolling]);

  React.useEffect(() => {
    const absoluteTimeoutId = setTimeout(() => {
      stopPolling();
      toast.error("O QR Code Pix expirou. Gere um novo pagamento para continuar.");
    }, 6 * 60 * 1000);

    const intervalId = setInterval(async () => {
      try {
        const result = await PublicPaymentService.getPaymentStatus(token, paymentId);

        consecutiveErrorsRef.current = 0;

        if (result.status === "approved") {
          stopPolling();
          clearTimeout(absoluteTimeoutId);
          setPaymentStatus("approved");
          onPaymentApproved();
        } else if (result.status === "rejected" || result.status === "cancelled") {
          stopPolling();
          clearTimeout(absoluteTimeoutId);
          setPaymentStatus("rejected");
        }
      } catch {
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= 3) {
          clearInterval(intervalId);
          clearTimeout(absoluteTimeoutId);
          toast.error("Não foi possível verificar o status do pagamento. Recarregue a página para tentar novamente.");
          return;
        }
      }
    }, 3000);

    pollingRef.current = intervalId;

    return () => {
      clearInterval(intervalId);
      clearTimeout(absoluteTimeoutId);
    };
  }, [token, paymentId, onPaymentApproved, stopPolling]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar código. Copie manualmente.");
    }
  };

  if (paymentStatus === "approved") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCheck className="h-8 w-8 text-green-500" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-lg">Pagamento aprovado!</p>
          <p className="text-sm text-muted-foreground">Obrigado pelo pagamento.</p>
        </div>
      </div>
    );
  }

  if (paymentStatus === "rejected") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-lg">Pagamento não aprovado</p>
          <p className="text-sm text-muted-foreground">
            O pagamento foi recusado ou cancelado. Tente novamente.
          </p>
        </div>
      </div>
    );
  }

  if (paymentStatus === "expired") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
          <Clock className="h-8 w-8 text-amber-500" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold text-lg">QR Code expirado</p>
          <p className="text-sm text-muted-foreground">
            O tempo para pagamento expirou. Gere um novo QR Code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Loader size="sm" />
        <span>Aguardando pagamento</span>
        <span className="ml-1 font-mono font-semibold text-foreground">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </span>
      </div>

      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <Image
          src={`data:image/png;base64,${qrCodeBase64}`}
          alt="QR Code PIX para pagamento"
          width={192}
          height={192}
          className="h-48 w-48 object-contain"
          unoptimized
        />
      </div>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        Abra o app do seu banco, acesse o PIX e escaneie o QR Code acima, ou copie o código abaixo.
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="w-full max-w-xs"
        style={
          primaryColor && copied
            ? { borderColor: primaryColor, color: primaryColor }
            : undefined
        }
      >
        {copied ? (
          <CheckCheck className="mr-2 h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {copied ? "Copiado!" : "Copiar código PIX"}
      </Button>
    </div>
  );
}
