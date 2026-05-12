"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { CreditCard, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AsaasService, type AsaasConnectionStatus } from "@/services/payment-service";
import { Loader } from "@/components/ui/loader";

export function AsaasConnectCard() {
  const [status, setStatus] = React.useState<AsaasConnectionStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(true);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = React.useState(false);

  const [apiKey, setApiKey] = React.useState("");
  const [environment, setEnvironment] = React.useState<"sandbox" | "production">("production");

  const loadStatus = React.useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const data = await AsaasService.getStatus();
      setStatus(data);
    } catch {
      toast.error("Erro ao carregar status do Asaas.");
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast.error("Informe a API key do Asaas.");
      return;
    }
    try {
      setIsConnecting(true);
      await AsaasService.connect(apiKey.trim(), environment);
      toast.success("Asaas conectado com sucesso!");
      setApiKey("");
      await loadStatus();
    } catch {
      toast.error("Erro ao conectar Asaas. Verifique a API key e tente novamente.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await AsaasService.disconnect();
      toast.success("Asaas desconectado.");
      setStatus({ connected: false });
    } catch {
      toast.error("Erro ao desconectar Asaas.");
    } finally {
      setIsDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  };

  return (
    <>
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar Asaas?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso desativará os pagamentos nos links compartilhados. Você poderá reconectar a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisconnect} disabled={isDisconnecting}>
              {isDisconnecting && <Loader size="sm" className="mr-2" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
                <CreditCard className="h-5 w-5 text-sky-500" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">Pagamentos Online (Asaas)</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  Aceite PIX e boleto nos links compartilhados
                </CardDescription>
              </div>
            </div>
            {!isLoadingStatus && status && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {status.connected && status.environment === "sandbox" && (
                  <Badge variant="warning">Sandbox</Badge>
                )}
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
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoadingStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader size="sm" />
              Carregando status...
            </div>
          ) : status?.connected ? (
            <>
              <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
                {status.environment && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ambiente</span>
                    <span className="capitalize">{status.environment === "production" ? "Produção" : "Sandbox"}</span>
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
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectDialog(true)}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting && <Loader size="sm" className="mr-2" />}
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="asaas-api-key">API Key</Label>
                  <Input
                    id="asaas-api-key"
                    type="password"
                    placeholder="$aact_..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    aria-label="API key do Asaas"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    Como obter: acesse{" "}
                    <a
                      href="https://www.asaas.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      asaas.com
                    </a>
                    {" "}→ Minha Conta → Integrações → API
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="asaas-environment">Ambiente</Label>
                  <Select
                    value={environment}
                    onValueChange={(val) => setEnvironment(val as "sandbox" | "production")}
                  >
                    <SelectTrigger id="asaas-environment" aria-label="Selecione o ambiente">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Produção</SelectItem>
                      <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={isConnecting || !apiKey.trim()}
              >
                {isConnecting ? (
                  <Loader size="sm" className="mr-2" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isConnecting ? "Conectando..." : "Conectar Asaas"}
              </Button>
            </>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
            Cada transação paga está sujeita às taxas do Asaas. O ProOps não cobra taxa adicional.
            Você é responsável pela declaração fiscal dos valores recebidos.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
