"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
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
    generate,
    enroll,
  } = useTotpEnrollment();

  const [qrDataUrl, setQrDataUrl] = React.useState("");

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

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Configurar autenticação em dois fatores (MFA)</CardTitle>
          <CardDescription>
            Como super admin, sua conta exige um segundo fator via aplicativo
            autenticador (TOTP), como Google Authenticator ou Authy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {stage === "intro" ? (
            <Button onClick={() => void generate()} disabled={busy} className="w-fit cursor-pointer">
              {busy ? "Gerando..." : "Gerar chave do autenticador"}
            </Button>
          ) : null}

          {stage === "secret" && secret ? (
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

              <Button onClick={() => void enroll()} disabled={busy} className="w-fit cursor-pointer">
                {busy ? "Validando..." : "Ativar MFA"}
              </Button>
            </div>
          ) : null}

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
    </div>
  );
}
