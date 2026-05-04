"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PlanService } from "@/services/plan-service";
import { StripeService } from "@/services/stripe-service";
import { BillingInterval, UserPlan } from "@/types";
import { BillingToggle } from "@/components/ui/billing-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, LogOut } from "lucide-react";
import { Loader } from "@/components/ui/loader";

export default function SubscriptionBlockedPlansPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();

  const [plans, setPlans] = useState<UserPlan[]>([]);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    let isMounted = true;

    const loadPlans = async () => {
      setIsLoadingPlans(true);
      setError(null);

      try {
        const data = await PlanService.getPlans();
        if (!isMounted) return;

        const ordered = [...data].sort((a, b) => a.order - b.order);
        setPlans(ordered);
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os planos.",
        );
      } finally {
        if (isMounted) {
          setIsLoadingPlans(false);
        }
      }
    };

    loadPlans();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user, router]);

  const handleSelectPlan = async (planTier: string) => {
    if (!user) return;

    setProcessingTier(planTier);
    setError(null);

    try {
      const result = await StripeService.createCheckout({
        userId: user.id,
        userEmail: user.email,
        planTier,
        billingInterval,
        origin: window.location.origin,
      });

      if (result.url) {
        window.location.href = result.url;
        return;
      }

      if (result.success) {
        router.push("/dashboard");
        return;
      }

      throw new Error("Não foi possível iniciar o checkout.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao iniciar checkout.",
      );
      setProcessingTier(null);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const plansWithDisplayPrice = useMemo(() => {
    return plans.map((plan) => {
      const price =
        billingInterval === "yearly"
          ? (plan.pricing?.yearly ?? plan.price)
          : (plan.pricing?.monthly ?? plan.price);

      return {
        ...plan,
        displayPrice: price,
      };
    });
  }, [plans, billingInterval]);

  if (authLoading || isLoadingPlans) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/subscription-blocked")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <>
                <Loader size="sm" className="mr-2" />
                Saindo...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4 mr-2" />
                Sair da Conta
              </>
            )}
          </Button>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Escolha seu plano</CardTitle>
            <CardDescription>
              Selecione o plano para reativar sua assinatura.
            </CardDescription>
            <div className="pt-2">
              <BillingToggle
                id="blocked-plans-toggle"
                value={billingInterval}
                onChange={setBillingInterval}
              />
            </div>
          </CardHeader>
        </Card>

        {error && (
          <Card>
            <CardContent className="pt-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {plansWithDisplayPrice.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-3xl font-semibold">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(plan.displayPrice)}
                </p>
                <p className="text-sm text-muted-foreground">
                  por {billingInterval === "yearly" ? "ano" : "mês"}
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleSelectPlan(plan.tier)}
                  disabled={processingTier !== null}
                >
                  {processingTier === plan.tier ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      Abrindo checkout...
                    </>
                  ) : (
                    "Selecionar plano"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
