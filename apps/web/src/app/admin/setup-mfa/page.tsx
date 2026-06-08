"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SetupMfaPage() {
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

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao painel
      </Link>
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
            <Button onClick={() => void generate()} disabled={busy} className="cursor-pointer">
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
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                />
              </div>

              <Button onClick={() => void enroll()} disabled={busy} className="cursor-pointer">
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
