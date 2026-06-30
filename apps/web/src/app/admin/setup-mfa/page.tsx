"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, KeyRound, QrCode, Smartphone } from "lucide-react";
import { m as motion } from "motion/react";
import QRCode from "qrcode";
import { useAuth } from "@/providers/auth-provider";
import { useTotpEnrollment } from "@/hooks/useTotpEnrollment";
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
import { toast } from "@/lib/toast";

const STEPS = [
  {
    icon: KeyRound,
    title: "Gere a chave",
    description: "Crie a chave do autenticador para a sua conta.",
  },
  {
    icon: QrCode,
    title: "Escaneie o QR code",
    description: "Abra o Google Authenticator ou Authy e escaneie o código.",
  },
  {
    icon: Smartphone,
    title: "Confirme o código",
    description: "Digite o código de 6 dígitos gerado pelo aplicativo.",
  },
];

export default function SetupMfaPage() {
  const router = useRouter();
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

  const [qrDataUrl, setQrDataUrl] = React.useState("");
  const [confirmDisableOpen, setConfirmDisableOpen] = React.useState(false);

  const showEnableFlow = !isEnrolled && stage !== "done";

  const handleDisable = async () => {
    const ok = await disable();
    setConfirmDisableOpen(false);
    if (ok) {
      toast.success("Verificação em dois fatores desativada.");
    }
  };

  // Render the otpauth URL as a scannable QR code (same flow as the user-facing
  // MFA section) so super admins can scan instead of typing the key by hand.
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

  return (
    <div className="space-y-8 p-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/admin")}
            className="rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Segurança (MFA)</h1>
              <p className="text-sm text-muted-foreground">
                Autenticação em dois fatores da sua conta de super admin
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="mx-auto w-full max-w-2xl"
      >
        <Card>
          <CardHeader>
            <CardTitle>Configurar autenticação em dois fatores (MFA)</CardTitle>
            <CardDescription>
              Como super admin, sua conta exige um segundo fator via aplicativo
              autenticador (TOTP), como Google Authenticator ou Authy.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {/* Já enrolado: status + opção de desativar */}
            {isEnrolled && stage !== "done" ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm">
                    Status:{" "}
                    <span className="font-medium text-emerald-600">Ativada</span>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sua conta já possui um aplicativo autenticador cadastrado. Para
                  trocar de dispositivo, desative e cadastre novamente.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDisableOpen(true)}
                  disabled={busy}
                  className="w-fit cursor-pointer"
                >
                  Desativar
                </Button>
              </div>
            ) : null}

            {/* Estado inicial: passos + ação */}
            {showEnableFlow && stage === "intro" ? (
              <div className="flex flex-col gap-6">
                <ol className="flex flex-col gap-4">
                  {STEPS.map((step, index) => {
                    const StepIcon = step.icon;
                    return (
                      <li key={step.title} className="flex items-start gap-4">
                        <div className="relative flex flex-col items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted/50 text-primary">
                            <StepIcon className="h-5 w-5" />
                          </div>
                          {index < STEPS.length - 1 ? (
                            <span className="mt-1 h-6 w-px bg-border" aria-hidden />
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-0.5 pt-1.5">
                          <span className="text-sm font-semibold leading-none">
                            {index + 1}. {step.title}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {step.description}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <Button
                  onClick={() => void generate()}
                  disabled={busy}
                  className="w-fit cursor-pointer"
                >
                  {busy ? "Gerando..." : "Gerar chave do autenticador"}
                </Button>
              </div>
            ) : null}

            {/* Exibição do segredo (QR + chave lado a lado) */}
            {showEnableFlow && stage === "secret" && secret ? (
              <div className="flex flex-col gap-6">
                <div className="grid items-start gap-6 sm:grid-cols-[auto_1fr]">
                  <div className="flex flex-col items-center gap-2">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="QR code para configuração do autenticador"
                        width={200}
                        height={200}
                        className="rounded-xl border bg-white p-3 shadow-sm"
                      />
                    ) : (
                      <div className="h-[200px] w-[200px] animate-pulse rounded-xl border bg-muted" />
                    )}
                    <span className="text-center text-xs text-muted-foreground">
                      Escaneie no app autenticador
                    </span>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label>Ou digite a chave manualmente</Label>
                      <code className="select-all break-all rounded-md bg-muted px-3 py-2 text-sm font-mono">
                        {secret.secretKey}
                      </code>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
                      <VerificationCodeInput
                        id="mfa-code"
                        value={code}
                        onChange={setCode}
                        onComplete={() => {
                          if (!busy) void enroll();
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => void enroll()}
                  disabled={busy}
                  className="w-fit cursor-pointer"
                >
                  {busy ? "Validando..." : "Ativar MFA"}
                </Button>
              </div>
            ) : null}

            {/* Sucesso */}
            {stage === "done" ? (
              <div className="flex flex-col gap-4">
                <Alert>
                  <AlertTitle>MFA ativado com sucesso</AlertTitle>
                  <AlertDescription>
                    Para que sua sessão passe a usar o segundo fator, saia e entre
                    novamente. No próximo login será solicitado o código do
                    autenticador.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => void logout()}
                  className="w-fit cursor-pointer"
                >
                  Sair e entrar novamente
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>

      <AlertDialog open={confirmDisableOpen} onOpenChange={setConfirmDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Desativar verificação em dois fatores?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sua conta de super admin deixará de pedir o código do autenticador
              no login. Recomendamos manter a verificação ativada para mais
              segurança.
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
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {busy ? "Desativando..." : "Sim, desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
