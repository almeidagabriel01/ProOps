"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CheckCircle, Lock, ShieldOff, XCircle } from "lucide-react";
import { Loader } from "@/components/ui/loader";
import { AuthService } from "@/services/auth-service";
import {
  resolveMfaRecoveryView,
  type MfaRecoveryView,
} from "@/lib/mfa-helpers";

function RecoverMfaContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token");

  const [isInspecting, setIsInspecting] = useState(true);
  const [view, setView] = useState<MfaRecoveryView>("invalid");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setView("invalid");
      setIsInspecting(false);
      return;
    }

    let active = true;
    AuthService.inspectMfaRecoveryToken(token)
      .then((result) => {
        if (!active) return;
        setView(resolveMfaRecoveryView(result));
      })
      .catch(() => {
        if (!active) return;
        setView("invalid");
      })
      .finally(() => {
        if (active) setIsInspecting(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await AuthService.confirmMfaRecovery(
        token,
        view === "password" ? password : undefined,
      );
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (confirmError: unknown) {
      const message =
        confirmError instanceof Error
          ? confirmError.message
          : "Não foi possível desativar a verificação em dois fatores.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInspecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md text-center py-10">
          <CardContent>
            <Loader size="lg" />
            <p className="text-muted-foreground">Verificando seu link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Link inválido
            </CardTitle>
            <CardDescription>
              Este link de recuperação é inválido ou expirou. Solicite um novo
              na tela de login, no passo de verificação em dois fatores.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/login")} className="w-full">
              Voltar para o login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-green-600 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Verificação desativada
            </CardTitle>
            <CardDescription>
              Verificação em dois fatores desativada. Faça login e reconfigure
              no seu perfil. Você será redirecionado em instantes.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/login")} className="w-full">
              Ir para o login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-primary" />
            Desativar verificação em dois fatores
          </CardTitle>
          <CardDescription>
            {view === "password"
              ? "Confirme sua senha para desativar a verificação em dois fatores e recuperar o acesso à sua conta."
              : "Confirme abaixo para desativar a verificação em dois fatores. Você poderá reconfigurá-la no seu perfil após entrar."}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleConfirm}>
          <CardContent className="space-y-4">
            {view === "password" ? (
              <div className="space-y-2">
                <Label htmlFor="recovery-password">
                  <span className="inline-flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Senha
                  </span>
                </Label>
                <Input
                  id="recovery-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                />
              </div>
            ) : null}
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={
                isSubmitting || (view === "password" && password.length === 0)
              }
            >
              {isSubmitting ? (
                <>
                  <Loader size="sm" className="mr-2" />
                  Desativando...
                </>
              ) : (
                "Desativar verificação em dois fatores"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default function RecoverMfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader size="lg" />
        </div>
      }
    >
      <RecoverMfaContent />
    </Suspense>
  );
}
