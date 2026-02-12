"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StripeService } from "@/services/stripe-service";
import { toast } from "react-toastify";
import { Loader2, PlayCircle, FlaskConical, RefreshCcw } from "lucide-react";

type SyncTotals = {
  scanned: number;
  eligible: number;
  synced: number;
  failed: number;
  pages: number;
};

const INITIAL_TOTALS: SyncTotals = {
  scanned: 0,
  eligible: 0,
  synced: 0,
  failed: 0,
  pages: 0,
};

export function SubscriptionSyncCard() {
  const [batchSize, setBatchSize] = useState("100");
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"dry" | "live" | null>(null);
  const [totals, setTotals] = useState<SyncTotals>(INITIAL_TOTALS);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorPreview, setErrorPreview] = useState<
    Array<{ userId: string; error: string }>
  >([]);

  const parsedLimit = useMemo(() => {
    const parsed = Number(batchSize);
    if (!Number.isFinite(parsed)) return 100;
    return Math.min(Math.max(Math.trunc(parsed), 1), 500);
  }, [batchSize]);

  const runSync = async (dryRun: boolean) => {
    setIsRunning(true);
    setMode(dryRun ? "dry" : "live");
    setTotals(INITIAL_TOTALS);
    setErrorPreview([]);

    let nextStartAfterId: string | undefined;
    let hasMore = true;
    let currentPage = 0;

    try {
      while (hasMore) {
        currentPage += 1;
        setStatusMessage(
          `${dryRun ? "Simulando" : "Sincronizando"} lote ${currentPage}...`,
        );

        const response = await StripeService.syncAllSubscriptions({
          dryRun,
          limit: parsedLimit,
          ...(nextStartAfterId ? { startAfterId: nextStartAfterId } : {}),
        });

        setTotals((prev) => ({
          scanned: prev.scanned + response.scanned,
          eligible: prev.eligible + response.eligible,
          synced: prev.synced + response.synced,
          failed: prev.failed + response.failed,
          pages: prev.pages + 1,
        }));

        if (response.errors?.length) {
          setErrorPreview((prev) => [...prev, ...response.errors].slice(0, 12));
        }

        hasMore = response.hasMore && !!response.nextStartAfterId;
        nextStartAfterId = response.nextStartAfterId || undefined;
      }

      setStatusMessage(
        dryRun
          ? "Simulação concluída. Nenhuma alteração foi gravada."
          : "Sincronização concluída com sucesso.",
      );

      toast.success(
        dryRun
          ? "Simulação concluída"
          : "Sincronização de assinaturas concluída",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao sincronizar assinaturas";
      setStatusMessage(`Falha: ${message}`);
      toast.error(message);
    } finally {
      setIsRunning(false);
      setMode(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCcw className="h-5 w-5" />
          Sincronização de Assinaturas Stripe
        </CardTitle>
        <CardDescription>
          Corrige inconsistências entre Stripe e Firestore para contas antigas.
          Execute primeiro em modo simulação para revisar o impacto.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="w-full sm:w-44">
            <label className="text-sm text-muted-foreground">
              Lote por requisição
            </label>
            <Input
              type="number"
              min={1}
              max={500}
              value={batchSize}
              onChange={(event) => setBatchSize(event.target.value)}
              disabled={isRunning}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => runSync(true)}
              disabled={isRunning}
            >
              {isRunning && mode === "dry" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FlaskConical className="w-4 h-4 mr-2" />
              )}
              Simular
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isRunning}>
                  {isRunning && mode === "live" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <PlayCircle className="w-4 h-4 mr-2" />
                  )}
                  Sincronizar Agora
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Confirmar sincronização real
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação vai gravar dados no Firestore com base no estado
                    atual do Stripe. Recomendado executar a simulação antes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => runSync(false)}>
                    Confirmar sincronização
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {statusMessage && (
          <p className="text-sm text-muted-foreground">{statusMessage}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Lotes: {totals.pages}</Badge>
          <Badge variant="secondary">Scanned: {totals.scanned}</Badge>
          <Badge variant="secondary">Elegíveis: {totals.eligible}</Badge>
          <Badge variant="secondary">Sincronizados: {totals.synced}</Badge>
          <Badge variant={totals.failed > 0 ? "destructive" : "secondary"}>
            Falhas: {totals.failed}
          </Badge>
        </div>

        {errorPreview.length > 0 && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Prévia de erros</p>
            <div className="space-y-1 max-h-40 overflow-auto">
              {errorPreview.map((error, index) => (
                <p
                  key={`${error.userId}-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  {error.userId}: {error.error}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
