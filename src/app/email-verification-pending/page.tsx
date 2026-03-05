"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/providers/auth-provider";
import { shouldBlockUnverifiedEmail } from "@/lib/auth/email-verification";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, MailCheck } from "lucide-react";

const RESEND_COOLDOWN_MS = 60_000;

function EmailVerificationPendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading: isAuthLoading, forceSyncSession } = useAuth();

  const [isChecking, setIsChecking] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(Date.now());
  const [cooldownLeft, setCooldownLeft] = useState<number>(
    Math.ceil(RESEND_COOLDOWN_MS / 1000),
  );
  const [message, setMessage] = useState<string>(
    "Enviamos um link de confirmação para o seu e-mail.",
  );

  const redirectParam = searchParams.get("redirect");

  const nextPath = useMemo(() => {
    if (!redirectParam) return "/";

    try {
      const decoded = decodeURIComponent(redirectParam);
      return decoded.startsWith("/") ? decoded : "/";
    } catch {
      return "/";
    }
  }, [redirectParam]);

  const currentPathWithParams = useMemo(() => {
    const params = new URLSearchParams();

    if (redirectParam) {
      params.set("redirect", redirectParam);
    }

    const query = params.toString();
    return query
      ? `/email-verification-pending?${query}`
      : "/email-verification-pending";
  }, [redirectParam]);

  const verifyAndRedirectIfConfirmed = useCallback(async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      setIsChecking(false);
      return false;
    }

    try {
      await currentUser.reload();
    } catch (e) {
      console.warn("Could not reload user", e);
    }

    if (!shouldBlockUnverifiedEmail(currentUser)) {
      try {
        await forceSyncSession();
      } catch (sessionError) {
        console.warn(
          "Could not refresh server session after email verification",
          sessionError,
        );
      }

      router.replace(nextPath);
      return true;
    }

    setIsChecking(false);
    return false;
  }, [forceSyncSession, nextPath, router]);

  useEffect(() => {
    if (isAuthLoading) return;

    verifyAndRedirectIfConfirmed();
  }, [isAuthLoading, verifyAndRedirectIfConfirmed]);

  useEffect(() => {
    if (!lastSentAt) {
      setCooldownLeft(0);
      return;
    }

    const updateCooldown = () => {
      const seconds = Math.max(
        0,
        Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000),
      );
      setCooldownLeft(seconds);
    };

    updateCooldown();
    const interval = window.setInterval(updateCooldown, 1_000);

    return () => window.clearInterval(interval);
  }, [lastSentAt]);

  const handleResendVerification = async () => {
    if (cooldownLeft > 0) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setMessage("Sua sessão expirou. Faça login novamente para continuar.");
      return;
    }

    setIsResending(true);

    try {
      await sendEmailVerification(currentUser, {
        url: `${window.location.origin}${currentPathWithParams}`,
      });

      setLastSentAt(Date.now());
      setMessage(
        "Um novo link de confirmação foi enviado. Se não aparecer, verifique spam/lixeira.",
      );
    } catch (error: unknown) {
      console.error("Failed to resend email verification:", error);
      const errorCode = (error as { code?: string })?.code;

      if (errorCode === "auth/too-many-requests") {
        setMessage(
          "Muitas tentativas de reenvio. Aguarde alguns minutos e tente novamente.",
        );
      } else if (errorCode === "auth/unauthorized-continue-uri") {
        setMessage(
          "Domínio do link não autorizado no Firebase Auth. Adicione este domínio em Authentication > Settings > Authorized domains.",
        );
      } else {
        setMessage(
          "Não foi possível reenviar agora. Tente novamente em instantes.",
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = async () => {
    setIsChecking(true);
    const isVerified = await verifyAndRedirectIfConfirmed();
    if (!isVerified) {
      setMessage(
        "E-mail ainda não confirmado. Verifique sua caixa de entrada.",
      );
    }
  };

  const canResend = cooldownLeft === 0;

  if (isAuthLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-10">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Verificando confirmação do seu e-mail...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!auth.currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sessão expirada</CardTitle>
            <CardDescription>
              Faça login novamente para concluir a confirmação do e-mail.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => router.replace("/login")}>
              Ir para login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 rounded-full bg-primary/10 p-3 w-fit">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Confirmação de e-mail pendente</CardTitle>
          <CardDescription>
            Abra o link enviado para <strong>{auth.currentUser.email}</strong>.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-sm text-muted-foreground text-center">{message}</p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={handleContinue}
            disabled={isChecking}
          >
            Já confirmei meu e-mail
          </Button>

          <Button
            className="w-full"
            variant="outline"
            onClick={handleResendVerification}
            disabled={!canResend || isResending}
          >
            {isResending
              ? "Reenviando..."
              : canResend
                ? "Reenviar e-mail"
                : `Reenviar em ${cooldownLeft}s`}
          </Button>

          <Button
            className="w-full"
            variant="ghost"
            onClick={async () => {
              await signOut(auth);
              router.replace("/login");
            }}
          >
            Sair da conta
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function EmailVerificationPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md text-center">
            <CardContent className="py-10">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Carregando...
              </p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <EmailVerificationPendingContent />
    </Suspense>
  );
}
