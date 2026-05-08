"use client";

import { Suspense } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CreditCard, Mail, LogOut, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StripeService } from "@/services/stripe-service";
import { Loader } from "@/components/ui/loader";
import { FullPageLoading } from "@/components/ui/full-page-loading";

function SubscriptionBlockedContent() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reasonParam = searchParams.get("reason");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Redirect logic is now handled server-side in layout.tsx:
  // - Active subscriptions are redirected to "/" before this page renders.
  // - Revoked sessions (post-cancel) render this page so the user sees what happened.

  const handleManageBilling = async () => {
    if (!user) return;
    setIsRedirecting(true);
    try {
      const result = await StripeService.createPortalSession({
        userId: user.id,
      });
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("Error opening billing portal:", error);
      setIsRedirecting(false);
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

  const getStatusMessage = () => {
    switch (reasonParam || user?.subscriptionStatus) {
      case "unpaid":
      case "past_due":
      case "payment_failed":
        return {
          title: "Falha no Pagamento",
          description:
            "Não foi possível processar o pagamento da sua assinatura. Atualize seu método de pagamento para continuar usando a solução.",
          icon: CreditCard,
        };
      case "canceled":
      case "cancelled":
        return {
          title: "Assinatura Cancelada",
          description:
            "Sua assinatura foi cancelada. Para continuar usando a solução, você precisa reativar sua assinatura.",
          icon: AlertTriangle,
        };
      case "inactive":
      default:
        return {
          title: "Assinatura Inativa",
          description:
            "Sua assinatura não está ativa. Por favor, entre em contato com nosso suporte ou atualize sua assinatura.",
          icon: AlertTriangle,
        };
    }
  };

  if (isLoading) {
    return <FullPageLoading />;
  }

  // user may be null when the session cookie was revoked (post past_due cancel).
  // The server gate in layout.tsx already verified this user is blocked; render the page.
  const status = getStatusMessage();
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <StatusIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl">{status.title}</CardTitle>
          <CardDescription className="text-base">
            {status.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            onClick={() => router.push("/subscription-blocked/plans")}
            className="w-full"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Ver Planos
          </Button>

          <Button
            onClick={handleManageBilling}
            disabled={isRedirecting}
            variant="outline"
            className="w-full"
          >
            {isRedirecting ? (
              <>
                <Loader size="sm" className="mr-2" />
                Abrindo...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Atualizar Pagamento
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              (window.location.href = "mailto:suporte@softcode.com.br")
            }
          >
            <Mail className="h-4 w-4 mr-2" />
            Contatar Suporte
          </Button>

          <Button
            variant="ghost"
            className="w-full"
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
        </CardContent>
      </Card>
    </div>
  );
}

export default function SubscriptionBlockedPage() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <SubscriptionBlockedContent />
    </Suspense>
  );
}
