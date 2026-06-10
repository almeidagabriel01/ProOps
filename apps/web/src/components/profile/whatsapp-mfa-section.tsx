"use client";

import * as React from "react";
import { MessageCircle, MessageCircleOff } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { WhatsappMfaService } from "@/services/whatsapp-mfa-service";
import {
  formatResendLabel,
  useResendCountdown,
} from "@/hooks/useResendCountdown";
import { isValidTotpCode, maskPhone } from "@/lib/mfa-helpers";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VerificationCodeInput } from "@/components/shared/verification-code-input";
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
import { PhoneInput } from "@/components/ui/phone-input";

type Stage = "intro" | "code" | "active";

interface WhatsappMfaSectionProps {
  /** Whether WhatsApp-MFA is currently enabled for the user (from users/{uid}). */
  isEnabled: boolean;
  /** The enrolled phone (masked or raw) to display when active, if known. */
  enabledPhone?: string;
  /** Called after a successful enroll/disable so the parent can re-read state. */
  onChanged?: () => void;
  /** Called only after a successful enroll (not on disable). */
  onEnrolled?: () => void;
  /** Called only after a successful disable (not on enroll). */
  onDisabled?: () => void;
  /** Disables the enroll flow with a hint (e.g. TOTP is the active method). */
  disabledReason?: string;
}

export function WhatsappMfaSection({
  isEnabled,
  enabledPhone,
  onChanged,
  onEnrolled,
  onDisabled,
  disabledReason,
}: WhatsappMfaSectionProps) {
  const [stage, setStage] = React.useState<Stage>(
    isEnabled ? "active" : "intro",
  );
  const [phone, setPhone] = React.useState("");
  const [maskedPhone, setMaskedPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirmDisableOpen, setConfirmDisableOpen] = React.useState(false);
  const {
    secondsLeft: resendSecondsLeft,
    canResend,
    start: startResendCountdown,
  } = useResendCountdown();

  React.useEffect(() => {
    setStage(isEnabled ? "active" : "intro");
  }, [isEnabled]);

  const handleStart = async () => {
    // The countdown owns the gate: while seconds remain, the send is disabled.
    if (!canResend) return;
    setError("");
    if (!phone.trim()) {
      setError("Informe o número de WhatsApp para receber o código.");
      return;
    }
    setBusy(true);
    try {
      const result = await WhatsappMfaService.startWhatsappEnroll(phone.trim());
      setMaskedPhone(result.maskedPhone || maskPhone(phone));
      setStage("code");
      setCode("");
      // Start the cooldown from the backend's authoritative value so a later
      // resend is blocked for the exact remaining time.
      startResendCountdown(result.retryAfterSeconds ?? 0);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // 409 means the number is already enrolled as MFA on another account.
          setError(
            err.message ||
              "Este número de WhatsApp já está vinculado a outra conta.",
          );
        } else if (err.status === 429) {
          // 429 body carries the remaining cooldown — start the countdown from it.
          const retryAfterSeconds = (
            err.data as { retryAfterSeconds?: number } | undefined
          )?.retryAfterSeconds;
          if (typeof retryAfterSeconds === "number") {
            startResendCountdown(retryAfterSeconds);
          }
          setError(
            err.message ||
              "Muitas solicitações. Aguarde um momento e tente novamente.",
          );
        } else if (err.status === 403) {
          setError("Este método não está disponível para a sua conta.");
        } else {
          setError(err.message || "Número inválido. Verifique e tente de novo.");
        }
      } else {
        setError("Não foi possível enviar o código. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setError("");
    const trimmed = code.trim();
    if (!isValidTotpCode(trimmed)) {
      setError("Digite o código de 6 dígitos enviado para o seu WhatsApp.");
      return;
    }
    setBusy(true);
    try {
      await WhatsappMfaService.verifyWhatsappEnroll(trimmed);
      setStage("active");
      setCode("");
      toast.success("Verificação por WhatsApp ativada.");
      onChanged?.();
      onEnrolled?.();
    } catch (err) {
      if (err instanceof ApiError) {
        const attemptsLeft = (err.data as { attemptsLeft?: number })
          ?.attemptsLeft;
        if (typeof attemptsLeft === "number") {
          setError(
            attemptsLeft > 0
              ? `Código inválido. Tentativas restantes: ${attemptsLeft}.`
              : "Código inválido. Solicite um novo código.",
          );
        } else {
          setError(err.message || "Código inválido ou expirado.");
        }
      } else {
        setError("Não foi possível confirmar o código. Tente novamente.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await WhatsappMfaService.disableWhatsappMfa();
      setConfirmDisableOpen(false);
      setStage("intro");
      setPhone("");
      setMaskedPhone("");
      toast.success("Verificação por WhatsApp desativada.");
      onChanged?.();
      onDisabled?.();
    } catch (err) {
      setConfirmDisableOpen(false);
      const message =
        err instanceof ApiError
          ? err.message
          : "Não foi possível desativar. Tente novamente.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const displayPhone = enabledPhone || maskedPhone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {stage === "active" ? (
            <MessageCircle className="h-5 w-5 text-emerald-600" />
          ) : (
            <MessageCircleOff className="h-5 w-5 text-muted-foreground" />
          )}
          Verificação por WhatsApp
        </CardTitle>
        <CardDescription>
          Receba um código no seu WhatsApp ao entrar. Mais prático, porém menos
          seguro que o aplicativo autenticador.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {disabledReason && stage === "intro" ? (
          <Alert>
            <AlertDescription>{disabledReason}</AlertDescription>
          </Alert>
        ) : null}

        {stage === "intro" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="whatsapp-mfa-phone">Número de WhatsApp</Label>
              <PhoneInput
                id="whatsapp-mfa-phone"
                name="whatsapp-mfa-phone"
                value={phone}
                disabled={busy || Boolean(disabledReason)}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => void handleStart()}
              disabled={
                busy || Boolean(disabledReason) || resendSecondsLeft > 0
              }
              className="w-fit gap-2 cursor-pointer"
            >
              {busy && <Spinner className="h-4 w-4 text-white" />}
              {busy
                ? "Enviando..."
                : formatResendLabel(resendSecondsLeft, {
                    readyLabel: "Enviar código",
                  })}
            </Button>
          </div>
        ) : null}

        {stage === "code" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Enviamos um código para o WhatsApp
              {displayPhone ? ` ${displayPhone}` : ""}.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp-mfa-code">Código de 6 dígitos</Label>
              <VerificationCodeInput
                id="whatsapp-mfa-code"
                value={code}
                onChange={setCode}
                onComplete={() => {
                  if (!busy) void handleConfirm();
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={busy || code.trim().length !== 6}
                className="w-fit gap-2 cursor-pointer"
              >
                {busy && <Spinner className="h-4 w-4 text-white" />}
                {busy ? "Validando..." : "Confirmar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStage("intro");
                  setCode("");
                  setError("");
                }}
                disabled={busy}
                className="w-fit cursor-pointer"
              >
                Voltar
              </Button>
            </div>
          </div>
        ) : null}

        {stage === "active" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Status:{" "}
              <span className="font-medium text-emerald-600">Ativada</span>
              {displayPhone ? (
                <span className="text-muted-foreground"> ({displayPhone})</span>
              ) : null}
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
      </CardContent>

      <AlertDialog
        open={confirmDisableOpen}
        onOpenChange={setConfirmDisableOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desativar verificação por WhatsApp?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sua conta deixará de pedir o código do WhatsApp no login.
              Recomendamos manter uma verificação em dois fatores ativada.
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
