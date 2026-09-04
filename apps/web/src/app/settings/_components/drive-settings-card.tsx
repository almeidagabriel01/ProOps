"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, FolderOpen, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
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
} from "@/components/ui/alert-dialog";
import { toast } from "@/lib/toast";
import { DriveService, type DriveStatus } from "@/services/drive-service";
import { useGooglePicker } from "@/hooks/use-google-picker";

/**
 * Conexão com o Google Drive.
 *
 * A tela tem dois passos, e a ordem importa: sem conta conectada não há como
 * escolher pasta, e sem pasta escolhida nada é entregue. Por isso o segundo
 * passo só aparece depois do primeiro — e o estado "conectado mas sem pasta"
 * é dito com todas as letras, porque é justamente onde a integração parece
 * pronta e não entrega nada.
 */

/** Motivos que o callback do OAuth devolve na URL. */
const REASON_MESSAGES: Record<string, string> = {
  access_denied: "Você recusou o acesso ao Google Drive.",
  invalid_state: "A sessão de autorização expirou. Tente conectar de novo.",
  expired_state: "A sessão de autorização expirou. Tente conectar de novo.",
  missing_refresh_token:
    "O Google não devolveu a autorização de longo prazo. Tente de novo e mantenha a permissão marcada.",
  oauth_failed: "Não foi possível concluir a conexão com o Google.",
};

interface DriveSettingsCardProps {
  onLoadingChange?: (loading: boolean) => void;
}

export function DriveSettingsCard({ onLoadingChange }: DriveSettingsCardProps) {
  const searchParams = useSearchParams();
  const { pickFolder, isOpening, isConfigured } = useGooglePicker();

  const [status, setStatus] = React.useState<DriveStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);

  React.useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  const load = React.useCallback(async () => {
    try {
      const data = await DriveService.getStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // O retorno do OAuth chega como query string, não como resposta de API — é um
  // redirect do Google. Sem tratar isso, o usuário volta para uma tela idêntica
  // e não sabe se deu certo.
  React.useEffect(() => {
    const resultado = searchParams.get("googleDrive");
    if (!resultado) return;
    if (resultado === "connected") {
      toast.success("Google Drive conectado.");
    } else {
      const reason = searchParams.get("reason") || "";
      toast.error(REASON_MESSAGES[reason] || "Não foi possível conectar o Google Drive.");
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [searchParams]);

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const { authUrl } = await DriveService.getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      setIsConnecting(false);
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível iniciar a conexão.",
      );
    }
  }

  async function handlePickFolder() {
    try {
      const folder = await pickFolder();
      if (!folder) return;
      await DriveService.setRootFolder(folder.id, folder.name);
      setStatus((atual) =>
        atual
          ? { ...atual, rootFolderId: folder.id, rootFolderName: folder.name }
          : atual,
      );
      toast.success(`As propostas serão entregues em "${folder.name}".`);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível escolher a pasta.",
      );
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      await DriveService.disconnect();
      setStatus({
        connected: false,
        connectedEmail: null,
        rootFolderId: null,
        rootFolderName: null,
      });
      setConfirmDisconnect(false);
      toast.success("Google Drive desconectado.");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Não foi possível desconectar.",
      );
    } finally {
      setIsDisconnecting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader size="md" />
      </div>
    );
  }

  const conectado = status?.connected === true;
  const temPasta = Boolean(status?.rootFolderId);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conta Google</CardTitle>
          <CardDescription>
            As propostas são entregues no seu Drive, com o seu armazenamento — a
            ProOps não guarda cópia lá nem impõe limite de espaço. Nada é lido do
            seu Drive: a integração só escreve.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {conectado ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Conectado
                {status?.connectedEmail ? (
                  <strong className="font-medium">{status.connectedEmail}</strong>
                ) : null}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDisconnect(true)}
              >
                <Unlink className="mr-2 h-4 w-4" />
                Desconectar
              </Button>
            </div>
          ) : (
            <Button
              className="self-start"
              onClick={() => void handleConnect()}
              disabled={isConnecting}
            >
              {isConnecting && <Loader size="sm" variant="button" className="mr-2" />}
              <Link2 className="mr-2 h-4 w-4" />
              Conectar Google Drive
            </Button>
          )}
        </CardContent>
      </Card>

      {conectado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pasta das propostas</CardTitle>
            <CardDescription>
              Escolha uma pasta que já existe no seu Drive. Dentro dela, cada
              cliente ganha uma subpasta automática, e toda proposta enviada cai
              nela. Se você usa Google Workspace,{" "}
              <strong className="text-foreground">
                prefira um Drive compartilhado
              </strong>{" "}
              — numa pasta pessoal tudo fica preso à sua conta, e a equipe perde
              o acesso se ela mudar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {temPasta ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <span className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <strong className="font-medium">{status?.rootFolderName}</strong>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePickFolder()}
                  disabled={isOpening || !isConfigured}
                >
                  {isOpening && <Loader size="sm" variant="button" className="mr-2" />}
                  Trocar pasta
                </Button>
              </div>
            ) : (
              <>
                {/* O estado que engana: conta conectada, integração parecendo
                    pronta, e nada sendo entregue por falta de destino. */}
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  Nenhuma pasta escolhida ainda — enquanto isso, nenhuma proposta
                  é enviada para o Drive.
                </p>
                <Button
                  className="self-start"
                  onClick={() => void handlePickFolder()}
                  disabled={isOpening || !isConfigured}
                >
                  {isOpening && <Loader size="sm" variant="button" className="mr-2" />}
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Escolher pasta no Drive
                </Button>
              </>
            )}

            {!isConfigured && (
              <p className="text-xs text-muted-foreground">
                O seletor de pastas do Google não está configurado neste
                ambiente.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o Google Drive?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  As pastas e os arquivos já enviados{" "}
                  <strong className="text-foreground">continuam no seu Drive</strong>
                  , intactos — nada é apagado.
                </p>
                <p>
                  O que para é a entrega automática: novas propostas deixam de
                  subir. Ao reconectar, será preciso autorizar de novo e escolher
                  a pasta outra vez.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDisconnect();
              }}
              disabled={isDisconnecting}
            >
              {isDisconnecting && (
                <Loader size="sm" variant="button" className="mr-2" />
              )}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
