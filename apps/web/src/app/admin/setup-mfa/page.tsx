"use client";

import * as React from "react";
import {
  multiFactor,
  TotpMultiFactorGenerator,
  type TotpSecret,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Stage = "intro" | "secret" | "done";

export default function SetupMfaPage() {
  const { logout } = useAuth();
  const [stage, setStage] = React.useState<Stage>("intro");
  const [secret, setSecret] = React.useState<TotpSecret | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handleGenerate = async () => {
    setError("");
    const user = auth.currentUser;
    if (!user) {
      setError("Sessão não encontrada. Saia e entre novamente.");
      return;
    }
    if (!user.emailVerified) {
      setError(
        "Seu email não está verificado. O Firebase exige email verificado antes de ativar o MFA — verifique seu email e tente de novo.",
      );
      return;
    }
    setBusy(true);
    try {
      const mfaSession = await multiFactor(user).getSession();
      const totpSecret =
        await TotpMultiFactorGenerator.generateSecret(mfaSession);
      setSecret(totpSecret);
      setStage("secret");
    } catch (err) {
      const codeStr =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      const msgStr =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
      if (codeStr === "auth/requires-recent-login") {
        setError(
          "Sua sessão é antiga. Saia e entre novamente, depois retorne a esta página.",
        );
      } else if (codeStr === "auth/unverified-email") {
        setError(
          "Seu email não está verificado. Verifique seu email antes de ativar o MFA.",
        );
      } else {
        setError(
          `Não foi possível iniciar a configuração do MFA: ${codeStr || msgStr}`,
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEnroll = async () => {
    setError("");
    if (!secret) return;
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Digite o código de 6 dígitos do seu aplicativo autenticador.");
      return;
    }
    setBusy(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("NO_USER");
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        trimmed,
      );
      await multiFactor(user).enroll(assertion, "Authenticator (TOTP)");
      setStage("done");
    } catch {
      setError(
        "Código inválido ou expirado. Confira o horário do dispositivo e tente o código atual.",
      );
    } finally {
      setBusy(false);
    }
  };

  const otpauthUrl = React.useMemo(() => {
    if (!secret) return "";
    const accountName = auth.currentUser?.email || "super-admin";
    return secret.generateQrCodeUrl(accountName, "ProOps");
  }, [secret]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <Card>
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
            <Button onClick={handleGenerate} disabled={busy} className="cursor-pointer">
              {busy ? "Gerando..." : "Gerar chave do autenticador"}
            </Button>
          ) : null}

          {stage === "secret" && secret ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label>Chave secreta (digite no app autenticador)</Label>
                <code className="select-all break-all rounded-md bg-muted px-3 py-2 text-sm font-mono">
                  {secret.secretKey}
                </code>
                <p className="text-xs text-muted-foreground break-all">
                  Ou use o link de configuração: {otpauthUrl}
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
                <Input
                  id="mfa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </div>

              <Button onClick={handleEnroll} disabled={busy} className="cursor-pointer">
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
                className="cursor-pointer"
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
