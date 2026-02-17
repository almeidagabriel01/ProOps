"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { ConnectedAccountService } from "@/services/connected-account-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Trash2,
  RefreshCw,
  Link as LinkIcon,
  Building2,
} from "lucide-react";
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
import dynamic from "next/dynamic";
import { toast } from "react-toastify";

// Dynamically import PluggyConnect to avoid SSR issues (it uses `window`)
const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((mod) => mod.PluggyConnect),
  { ssr: false },
);

interface ConnectedAccountsListProps {
  tenantId: string;
}

export function ConnectedAccountsList({
  tenantId,
}: ConnectedAccountsListProps) {
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  const {
    accounts,
    loading,
    fetchAccounts,
    removeAccount,
    createAccount,
    syncAccount,
  } = useConnectedAccounts(tenantId);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleConnect = useCallback(async () => {
    setIsLoadingToken(true);
    try {
      const token = await ConnectedAccountService.getConnectToken();
      setConnectToken(token);
      setIsWidgetOpen(true);
    } catch {
      toast.error("Erro ao iniciar conexão bancária. Tente novamente.");
    } finally {
      setIsLoadingToken(false);
    }
  }, []);

  const handleSuccess = useCallback(
    async (data: {
      item: { id: string; connector?: { name?: string; imageUrl?: string } };
    }) => {
      setIsWidgetOpen(false);
      setConnectToken(null);

      const item = data.item;
      await createAccount({
        provider: "pluggy",
        providerItemId: item.id,
        bankName: item.connector?.name || "Instituição Financeira",
        bankImageUrl: item.connector?.imageUrl || "",
      });
    },
    [createAccount],
  );

  const handleClose = useCallback(() => {
    setIsWidgetOpen(false);
    setConnectToken(null);
  }, []);

  const handleError = useCallback((error: { message: string }) => {
    console.error("Pluggy Connect error:", error);
    toast.error(`Erro na conexão: ${error.message}`);
    setIsWidgetOpen(false);
    setConnectToken(null);
  }, []);

  if (loading && accounts.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pluggy Connect Widget (rendered invisibly until opened) */}
      {isWidgetOpen && connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={true}
          onSuccess={handleSuccess}
          onError={handleError}
          onClose={handleClose}
          language="pt"
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Instituições Conectadas
        </h2>
        <Button onClick={handleConnect} disabled={isLoadingToken || loading}>
          {isLoadingToken ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LinkIcon className="mr-2 h-4 w-4" />
          )}
          Conectar Nova Conta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground">
              Nenhuma conta conectada
            </p>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta bancária para importar transações
              automaticamente.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={handleConnect}
              disabled={isLoadingToken}
            >
              {isLoadingToken ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Conectar Agora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {account.bankName || "Instituição Financeira"}
                </CardTitle>
                <Badge
                  variant={
                    account.status === "active" ? "default" : "destructive"
                  }
                >
                  {account.status === "active" ? "Ativo" : "Erro"}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4 pt-4">
                  {account.bankImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={account.bankImageUrl}
                      alt={account.bankName || "Bank"}
                      className="h-10 w-10 rounded-full object-contain"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Building2 className="h-5 w-5 opacity-50" />
                    </div>
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Última sincronização
                    </p>
                    <p className="text-xs font-medium">
                      {account.lastSyncAt
                        ? new Date(account.lastSyncAt).toLocaleString()
                        : "Nunca"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      setSyncingAccountId(account.id);
                      await syncAccount(account.id);
                      fetchAccounts();
                      setSyncingAccountId(null);
                    }}
                    disabled={syncingAccountId === account.id}
                    title="Sincronizar agora"
                  >
                    {syncingAccountId === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso irá desconectar a conta e parar a importação
                          automática de transações. Os lançamentos já importados
                          não serão afetados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeAccount(account.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Desconectar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
