"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/firebase";
import { ApiError } from "@/lib/api-client";

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading, refreshUser } = useAuth();

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [planName, setPlanName] = useState<string>("");
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const returnUrl = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`,
      );
      router.push(`/login?redirect=${returnUrl}`);
      return;
    }

    const confirmAndRedirect = async (retryCount = 0) => {
      // Prevent double execution
      if (hasProcessed.current && retryCount === 0) return;
      if (retryCount === 0) {
        hasProcessed.current = true;
      }

      const sessionId = searchParams.get("session_id");

      if (!sessionId) {
        setStatus("error");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      try {
        const currentAuthUser = auth.currentUser;
        if (currentAuthUser) {
          const idToken = await currentAuthUser.getIdToken(true);
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ idToken }),
          });
        }

        // Call Cloud Function to confirm checkout and update user in Firestore
        const { StripeService } = await import("@/services/stripe-service");
        const data = await StripeService.confirmCheckout({ sessionId });

        setPlanName(data.planTier?.toUpperCase() || "");

        // Refresh user data to get updated role and planId
        await refreshUser();

        // Show success state
        setStatus("success");

        // Redirect to dashboard after showing success
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } catch (error) {
        console.error("Error confirming checkout:", error);

        const isForbidden = error instanceof ApiError && error.status === 403;
        if (isForbidden && retryCount < 1) {
          try {
            const currentAuthUser = auth.currentUser;
            if (currentAuthUser) {
              const idToken = await currentAuthUser.getIdToken(true);
              await fetch("/api/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ idToken }),
              });
            }
          } catch (sessionRetryError) {
            console.warn(
              "Session refresh retry failed during checkout confirmation",
              sessionRetryError,
            );
          }

          await new Promise((resolve) => setTimeout(resolve, 800));
          return confirmAndRedirect(retryCount + 1);
        }

        setStatus("error");
      }
    };

    confirmAndRedirect();
  }, [searchParams, refreshUser, router, authLoading, user]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
        {status === "loading" && (
          <>
            <div className="relative mx-auto w-16 h-16 mb-6">
              <Loader2 className="w-16 h-16 animate-spin text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              Processando pagamento...
            </h1>
            <p className="text-muted-foreground">
              Aguarde enquanto confirmamos sua assinatura
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto w-16 h-16 mb-6 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-green-500">
              Assinatura confirmada!
            </h1>
            <p className="text-muted-foreground">
              {planName
                ? `Plano ${planName} ativado com sucesso!`
                : "Seu plano foi ativado com sucesso!"}
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Redirecionando para o dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto w-16 h-16 mb-6 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-500">Erro</h1>
            <p className="text-muted-foreground mb-5">
              Não foi possível confirmar automaticamente sua assinatura.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                Ir para dashboard
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
