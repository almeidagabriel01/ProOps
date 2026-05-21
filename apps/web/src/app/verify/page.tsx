"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MailCheck, XCircle } from "lucide-react";
import { Loader } from "@/components/ui/loader";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get("code");

  const [isVerifying, setIsVerifying] = useState<boolean>(Boolean(code));
  const [error, setError] = useState<string | null>(
    code ? null : "Link inválido ou ausente.",
  );
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!code) return;

    applyActionCode(auth, code)
      .then(async () => {
        try {
          if (auth.currentUser) {
            await auth.currentUser.reload();
          }
        } catch (reloadError) {
          console.warn(
            "Could not reload current user after email verification",
            reloadError,
          );
        }
        setSuccess(true);
        setIsVerifying(false);
      })
      .catch((verificationError) => {
        console.error(verificationError);
        setError("O link de confirmação é inválido ou expirou.");
        setIsVerifying(false);
      });
  }, [code]);

  if (isVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md text-center py-10">
          <CardContent>
            <Loader size="lg" />
            <p className="text-muted-foreground">
              Validando a confirmação do seu e-mail...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              Link Inválido
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/login")} className="w-full">
              Voltar para o Login
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
              <MailCheck className="w-5 h-5" />
              E-mail confirmado!
            </CardTitle>
            <CardDescription>
              Sua confirmação foi concluída. Retorne para a aba anterior e
              clique em &nbsp;&quot;Já confirmei meu e-mail&quot; para
              continuar.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/login")} className="w-full">
              Ir para o Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return null;
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader size="lg" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
