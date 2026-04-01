"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Loader2, CreditCard, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/lib/firebase";
import { ApiError } from "@/lib/api-client";

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Professional",
  enterprise: "Enterprise",
};

const INTERVAL_LABELS: Record<string, string> = {
  monthly: "mensal",
  yearly: "anual",
};

function SubscribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Ref to prevent multiple checkout initiations
  const checkoutInitiatedRef = useRef(false);

  const planTier = searchParams.get("plan");
  const billingInterval = searchParams.get("interval") || "monthly";
  const skipTrial = searchParams.get("skipTrial") === "true";

  useEffect(() => {
    // If no plan specified, redirect to home
    if (!planTier || !PLAN_NAMES[planTier]) {
      router.push("/");
      return;
    }

    // Wait for auth to load
    if (isAuthLoading) return;

    // If not logged in, redirect to login with return URL
    if (!user) {
      const returnUrl = encodeURIComponent(
        `/subscribe?plan=${planTier}&interval=${billingInterval}`,
      );
      router.push(`/login?redirect=${returnUrl}`);
      return;
    }

    // Prevent multiple checkout calls
    if (checkoutInitiatedRef.current) return;
    checkoutInitiatedRef.current = true;

    // User is logged in, proceed to Stripe checkout
    initiateCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planTier, user, isAuthLoading, router, billingInterval]);

  const initiateCheckout = async (retryCount = 0) => {
    if (!user || !planTier) return;

    // Only set processing on first attempt
    if (retryCount === 0) {
      setError(null);
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

      const { StripeService } = await import("@/services/stripe-service");

      const data = await StripeService.createCheckout({
        userId: user.id,
        planTier: planTier,
        userEmail: user.email,
        billingInterval: billingInterval as "monthly" | "yearly",
        origin: window.location.origin,
        ...(skipTrial && { skipTrial: true }),
      });

      if (data.url) {
        window.location.href = data.url;
      } else if (data.success) {
        // Subscription was updated (no redirect needed)
        router.push("/profile");
      } else {
        throw new Error("Erro ao criar sessão de pagamento");
      }
    } catch (err: unknown) {
      console.error("Checkout error:", err);

      // Check for user not found error (race condition after registration)
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isUserNotFound =
        errorMessage.includes("not-found") ||
        errorMessage.includes("User not found") ||
        errorMessage.includes("not found");

      if (isUserNotFound && retryCount < 3) {
        console.log(`User not found, retrying... (${retryCount + 1}/3)`);
        // Increase delay to give Firestore more time to propagate
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return initiateCheckout(retryCount + 1);
      }

      const isForbidden = err instanceof ApiError && err.status === 403;
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
          console.warn("Session refresh retry failed", sessionRetryError);
        }

        await new Promise((resolve) => setTimeout(resolve, 800));
        return initiateCheckout(retryCount + 1);
      }

      setError(
        err instanceof Error ? err.message : "Erro ao processar assinatura",
      );
      // Reset ref so user can retry manually
      checkoutInitiatedRef.current = false;
    }
  };

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">
            Erro na assinatura
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setError(null);
                initiateCheckout();
              }}
              className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
            >
              Tentar novamente
            </button>
            <Link
              href="/"
              className="block w-full py-3 bg-muted hover:bg-muted/70 text-foreground rounded-xl font-medium transition-colors text-center"
            >
              <ArrowLeft className="w-4 h-4 inline mr-2" />
              Voltar para a home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading/Processing state
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold text-foreground mb-2">
          {isAuthLoading
            ? "Verificando sua conta..."
            : "Preparando pagamento..."}
        </h1>
        <p className="text-muted-foreground">
          {planTier && PLAN_NAMES[planTier] ? (
            <>
              Você está assinando o plano{" "}
              <span className="text-primary font-semibold">
                {PLAN_NAMES[planTier]}
              </span>{" "}
              ({INTERVAL_LABELS[billingInterval] || billingInterval})
              {planTier === "pro" && (
                <span className="block mt-2 text-emerald-500 text-sm font-medium">
                  Inclui 7 dias grátis para testar
                </span>
              )}
            </>
          ) : (
            "Redirecionando..."
          )}
        </p>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      }
    >
      <SubscribeContent />
    </Suspense>
  );
}
