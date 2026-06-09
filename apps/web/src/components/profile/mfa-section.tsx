"use client";

import * as React from "react";
import QRCode from "qrcode";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";
import { useTotpEnrollment } from "@/hooks/useTotpEnrollment";
import { canEnrollMfa } from "@/lib/mfa-helpers";
import { AuthService } from "@/services/auth-service";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

interface MfaSectionProps {
  /** Fires once when a TOTP enrollment completes (stage transitions to "done"). */
  onEnrolled?: () => void;
  /** Fires when the TOTP factor is successfully disabled. */
  onDisabled?: () => void;
}

export function MfaSection({ onEnrolled, onDisabled }: MfaSectionProps = {}) {
  const { logout } = useAuth();
  const {
    stage,
    secret,
    otpauthUrl,
    code,
    setCode,
    error,
    busy,
    isEnrolled,
    generate,
    enroll,
    disable,
  } = useTotpEnrollment();

  const [emailVerified, setEmailVerified] = React.useState<boolean>(
    () => auth.currentUser?.emailVerified ?? false,
  );
  const [qrDataUrl, setQrDataUrl] = React.useState("");
  const [resending, setResending] = React.useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      setEmailVerified(user?.emailVerified ?? false);
    });
    return unsubscribe;
  }, []);

  // Notify the parent once when enrollment completes, without altering the
  // enroll flow itself (driven by the hook's `stage`).
  const enrolledNotifiedRef = React.useRef(false);
  React.useEffect(() => {
    if (stage === "done" && !enrolledNotifiedRef.current) {
      enrolledNotifiedRef.current = true;
      onEnrolled?.();
    }
    if (stage !== "done") {
      enrolledNotifiedRef.current = false;
    }
  }, [stage, onEnrolled]);

  React.useEffect(() => {
    let active = true;
    if (!otpauthUrl) {
      setQrDataUrl("");
      return;
    }
    QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [otpauthUrl]);

  const handleResendVerification = async () => {
    setResending(true);
    try {
      await AuthService.sendVerificationEmail();
      toast.success(
        "Email de verificação enviado. Confira sua caixa de entrada.",
      );
    } catch {
      toast.error(
        "Não foi possível enviar o email de verificação. Tente novamente.",
      );
    } finally {
      setResending(false);
    }
  };

  const handleDisable = async () => {
    const ok = await disable();
    setConfirmDisableOpen(false);
    if (ok) {
      toast.success("Verificação em dois fatores desativada.");
      onDisabled?.();
    }
  };

  const emailGate = canEnrollMfa({ emailVerified });
  const showEnableFlow = !isEnrolled && stage !== "done";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEnrolled ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          Verificação em dois fatores
        </CardTitle>
        <CardDescription>
          Proteja sua conta exigindo um código de um aplicativo autenticador
          (Google Authenticator, Authy, etc.) além da senha ao entrar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!emailGate.ok && showEnableFlow ? (
          <Alert>
            <AlertTitle>Verifique seu email primeiro</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>
                Para ativar a verificação em dois fatores, seu email precisa
                estar verificado.
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleResendVerification()}
                disabled={resending}
                className="w-fit gap-2 cursor-pointer"
              >
                {resending && <Spinner className="h-4 w-4" />}
                {resending ? "Enviando..." : "Reenviar verificação"}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Já enrolado */}
        {isEnrolled && stage !== "done" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Status:{" "}
              <span className="font-medium text-emerald-600">Ativada</span>
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDisableOpen(true)}
              disabled={busy}
              className="w-fit cursor-pointer"
            >
              Desativar
            </Button>
          </div>
        ) : null}

        {/* Início do enrollment */}
        {showEnableFlow && stage === "intro" ? (
          <Button
            type="button"
            onClick={() => void generate()}
            disabled={busy || !emailGate.ok}
            className="w-fit gap-2 cursor-pointer"
          >
            {busy && <Spinner className="h-4 w-4 text-white" />}
            {busy ? "Gerando..." : "Ativar verificação em dois fatores"}
          </Button>
        ) : null}

        {/* Exibição do segredo (QR + chave) */}
        {showEnableFlow && stage === "secret" && secret ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Escaneie o QR code no seu app autenticador</Label>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="QR code para configuração do autenticador"
                  width={220}
                  height={220}
                  className="rounded-md border bg-white p-2"
                />
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <Label>Ou digite a chave manualmente</Label>
              <code className="select-all break-all rounded-md bg-muted px-3 py-2 text-sm font-mono">
                {secret.secretKey}
              </code>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="profile-mfa-code">Código de 6 dígitos</Label>
              <Input
                id="profile-mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
              />
            </div>

            <Button
              type="button"
              onClick={() => void enroll()}
              disabled={busy}
              className="w-fit gap-2 cursor-pointer"
            >
              {busy && <Spinner className="h-4 w-4 text-white" />}
              {busy ? "Validando..." : "Ativar"}
            </Button>
          </div>
        ) : null}

        {/* Sucesso */}
        {stage === "done" ? (
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertTitle>Verificação em dois fatores ativada</AlertTitle>
              <AlertDescription>
                Para que sua sessão passe a usar o segundo fator, saia e entre
                novamente. No próximo login será solicitado o código do
                autenticador.
              </AlertDescription>
            </Alert>
            <Button
              type="button"
              onClick={() => void logout()}
              className="w-fit cursor-pointer"
            >
              Sair e entrar novamente
            </Button>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={confirmDisableOpen} onOpenChange={setConfirmDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desativar verificação em dois fatores?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sua conta deixará de pedir o código do autenticador no login.
              Recomendamos manter a verificação ativada para mais segurança.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDisable();
              }}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600 gap-2"
            >
              {busy && <Spinner className="h-4 w-4 text-white" />}
              {busy ? "Desativando..." : "Sim, desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
