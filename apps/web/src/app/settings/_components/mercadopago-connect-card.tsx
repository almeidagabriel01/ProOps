"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { CreditCard, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MercadoPagoService, type MercadoPagoStatus } from "@/services/mercadopago-service";
import { Loader } from "@/components/ui/loader";

export function MercadoPagoConnectCard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = React.useState<MercadoPagoStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [isProcessingCallback, setIsProcessingCallback] = React.useState(false);
  const processedCodeRef = React.useRef<string | null>(null);

  const loadStatus = React.useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const data = await MercadoPagoService.getStatus();
      setStatus(data);
    } catch {
      toast.error("Erro ao carregar status do Mercado Pago.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    const code = searchParams.get("mp_code");
    const state = searchParams.get("mp_state");
    const error = searchParams.get("mp_error");

    if (code && state) {
      if (processedCodeRef.current === code) return;
      processedCodeRef.current = code;

      // Clean params from URL immediately so remounts can't resubmit the same code.
      // Using replaceState (not router.replace) to avoid triggering useEffect again.
      window.history.replaceState({}, "", "/profile");

      setIsProcessingCallback(true);
      MercadoPagoService.processCallback(code, state)
        .then(() => {
          toast.success("Mercado Pago conectado com sucesso!");
          loadStatus();
        })
        .catch((err: unknown) => {
          // 409 means the code was already processed (concurrent or prior attempt).
          // Treat as success: load status to reflect current connection state.
          const status = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
          if (status === 409) {
            loadStatus();
            return;
          }
          toast.error("Erro ao conectar Mercado Pago. Tente novamente.");
        })
        .finally(() => {
          setIsProcessingCallback(false);
        });
    } else if (error) {
      toast.error("Autorização cancelada ou erro no Mercado Pago.");
      router.replace("/profile");
    } else {
      loadStatus();
    }
  }, [searchParams, router, loadStatus]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const { authUrl } = await MercadoPagoService.getOAuthUrl();
      window.location.href = authUrl;
    } catch {
      toast.error("Erro ao iniciar conexão com Mercado Pago.");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja desconectar o Mercado Pago? Isso desativará os pagamentos nos links compartilhados.",
    );
    if (!confirmed) return;

    try {
      setIsDisconnecting(true);
      await MercadoPagoService.disconnect();
      toast.success("Mercado Pago desconectado.");
      setStatus({ connected: false });
    } catch {
      toast.error("Erro ao desconectar Mercado Pago.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isLoading = isLoadingStatus || isProcessingCallback;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
              <CreditCard className="h-5 w-5 text-sky-500" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Receba pagamentos online</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Mercado Pago
              </CardDescription>
            </div>
          </div>
          {!isLoading && status && (
            <Badge variant={status.connected ? "success" : "secondary"}>
              {status.connected ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Conectado
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" aria-hidden="true" />
                  Não conectado
                </span>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Conecte sua conta Mercado Pago para aceitar PIX, cartão de crédito e boleto diretamente
          nos links compartilhados.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader size="sm" />
            {isProcessingCallback ? "Finalizando conexão..." : "Carregando status..."}
          </div>
        ) : (
          <>
            {status?.connected && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                {status.userId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ID da conta</span>
                    <span className="font-mono text-xs">{status.userId}</span>
                  </div>
                )}
                {status.connectedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Conectado em</span>
                    <span>
                      {new Date(status.connectedAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ambiente</span>
                  <Badge variant={(status.environment ?? (status.liveMode ? "production" : "sandbox")) === "production" ? "default" : "warning"}>
                    {(status.environment ?? (status.liveMode ? "production" : "sandbox")) === "production" ? "Produção" : "Sandbox"}
                  </Badge>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {status?.connected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting && (
                    <Loader size="sm" className="mr-2" />
                  )}
                  Desconectar
                </Button>
              ) : (
                <Button size="sm" onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader size="sm" className="mr-2" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                  )}
                  Conectar Mercado Pago
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
              Ao conectar, cada transação paga possui taxa do Mercado Pago. O ProOps não cobra taxa
              adicional. Você é responsável pela declaração fiscal dos valores recebidos.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
