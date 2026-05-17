"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { AsaasWebhookStatus } from "@/services/payment-service";

interface AsaasWebhookStatusAlertProps {
  webhookStatus: AsaasWebhookStatus;
  onRetry: () => Promise<void>;
}

export function AsaasWebhookStatusAlert({ webhookStatus, onRetry }: AsaasWebhookStatusAlertProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showErrorDetail, setShowErrorDetail] = useState(false);

  if (webhookStatus.state === "registered") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Recebimento de pagamentos configurado</span>
      </div>
    );
  }

  if (webhookStatus.state === "pending") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span>Configurando recebimento de pagamentos...</span>
      </div>
    );
  }

  const errorMessage =
    webhookStatus.lastError?.asaasErrors?.[0]?.description ??
    webhookStatus.lastError?.message ??
    "Erro desconhecido";

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Recebimento automático não configurado</AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>
          O webhook de pagamentos não foi registrado no Asaas. Você não receberá notificações
          automáticas de pagamento.
        </p>
        <button
          type="button"
          className="text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
          onClick={() => setShowErrorDetail((v) => !v)}
        >
          {showErrorDetail ? "Ocultar detalhe" : "Ver detalhe do erro"}
        </button>
        {showErrorDetail && (
          <p className="rounded bg-destructive/10 px-2 py-1 text-xs font-mono break-all">
            {errorMessage}
            {webhookStatus.lastError?.httpStatus
              ? ` (HTTP ${webhookStatus.lastError.httpStatus})`
              : ""}
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={isRetrying}
          onClick={handleRetry}
          className="mt-1"
        >
          {isRetrying ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Tentando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-3 w-3" />
              Tentar reconectar webhook
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
