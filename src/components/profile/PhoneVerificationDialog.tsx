"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/lib/toast";
import { callApi, ApiError } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Loader2 } from "lucide-react";

const SEND_COOLDOWN_MS = 60_000;

interface PhoneVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Número de telefone já cadastrado no perfil do usuário (E.164 ou dígitos) */
  initialPhoneNumber?: string;
}

/** Formata número para o padrão brasileiro de exibição: +55 (XX) XXXXX-XXXX */
function formatPhoneBR(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) {
    const ddd = digits.substring(2, 4);
    const number = digits.substring(4);
    if (number.length === 9)
      return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    if (number.length === 8)
      return `+55 (${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
  }
  return phone;
}

/**
 * Modal de verificação de telefone via WhatsApp OTP.
 *
 * O backend gera um código de 6 dígitos, salva no Firestore com TTL de 10 min
 * e envia via WhatsApp Business API. Nenhum reCAPTCHA ou Firebase Phone Auth
 * é utilizado.
 */
export function PhoneVerificationDialog({
  open,
  onOpenChange,
  onSuccess,
  initialPhoneNumber = "",
}: PhoneVerificationDialogProps) {
  const [isChangingNumber, setIsChangingNumber] = useState(!initialPhoneNumber);
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [otpCode, setOtpCode] = useState("");
  const [isAwaitingCode, setIsAwaitingCode] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  // Cooldown state for resend button
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setPhoneNumber(initialPhoneNumber);
      setIsChangingNumber(!initialPhoneNumber);
      setOtpCode("");
      setIsAwaitingCode(false);
      setError("");
      setLastSentAt(null);
      setCooldownLeft(0);
    }
  }, [open, initialPhoneNumber]);

  // Cooldown countdown
  useEffect(() => {
    if (!lastSentAt) {
      setCooldownLeft(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((SEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000),
      );
      setCooldownLeft(remaining);
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [lastSentAt]);

  const handleSendCode = useCallback(async (phone: string) => {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Por favor, informe um número de telefone válido.");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      await callApi("v1/phone-otp/send", "POST", { phoneNumber: phone });
      setLastSentAt(Date.now());
      setIsAwaitingCode(true);
      toast.success("Código enviado via WhatsApp! Verifique seu telefone.");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Não foi possível enviar o código. Tente novamente.";
      setError(msg);
    } finally {
      setIsSending(false);
    }
  }, []);

  const handleVerifyCode = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError("Digite o código de 6 dígitos recebido no WhatsApp.");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      await callApi("v1/phone-otp/verify", "POST", { code: otpCode.trim() });
      toast.success("Telefone verificado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Não foi possível confirmar o código. Tente novamente.";
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verificação de Telefone</DialogTitle>
          <DialogDescription>
            Confirme seu número para ativar a integração com o WhatsApp. Você
            receberá um código de verificação via mensagem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ─── Etapa 1: Confirmar ou trocar número ─── */}
          {!isAwaitingCode && (
            <>
              {!isChangingNumber && initialPhoneNumber ? (
                <div className="flex flex-col gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-1">
                      Número atual de WhatsApp / Telefone:
                    </p>
                    <p className="text-xl font-semibold tracking-wide">
                      {formatPhoneBR(initialPhoneNumber)}
                    </p>
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => setIsChangingNumber(true)}
                      disabled={isSending}
                    >
                      Alterar Número
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleSendCode(initialPhoneNumber)}
                      disabled={isSending}
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Confirmar e Enviar Código"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium leading-none">
                      Novo WhatsApp / Telefone
                    </label>
                    <PhoneInput
                      name="verify-phone"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {initialPhoneNumber && (
                      <Button
                        className="flex-1"
                        variant="ghost"
                        onClick={() => {
                          setIsChangingNumber(false);
                          setPhoneNumber(initialPhoneNumber);
                          setError("");
                        }}
                        disabled={isSending}
                      >
                        Cancelar
                      </Button>
                    )}
                    <Button
                      className="flex-1"
                      onClick={() => handleSendCode(phoneNumber)}
                      disabled={isSending || !phoneNumber}
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        "Receber Código pelo WhatsApp"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ─── Etapa 2: Código recebido no WhatsApp ─── */}
          {isAwaitingCode && (
            <div className="p-4 border border-border rounded-xl bg-muted/20 space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Enviamos um código de 6 dígitos para{" "}
                <strong>{formatPhoneBR(phoneNumber)}</strong> via WhatsApp.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  Código de verificação
                </label>
                <Input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleVerifyCode}
                  disabled={isVerifying || otpCode.length < 6}
                >
                  {isVerifying ? "Confirmando..." : "Confirmar Telefone"}
                </Button>
              </div>

              <div className="flex flex-col items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSendCode(phoneNumber)}
                  disabled={isSending || cooldownLeft > 0}
                >
                  {isSending
                    ? "Reenviando..."
                    : cooldownLeft > 0
                      ? `Reenviar em ${cooldownLeft}s`
                      : "Reenviar código"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAwaitingCode(false);
                    setOtpCode("");
                    setError("");
                  }}
                  disabled={isVerifying}
                >
                  Mudar número de telefone
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
