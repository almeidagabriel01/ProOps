"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CreditCard, LogIn, LogOut, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";
import { useAuth } from "@/providers/auth-provider";
import { StripeService } from "@/services/stripe-service";
import { SUPPORT_WHATSAPP_DIGITS, buildWhatsAppHref } from "@/lib/whatsapp-contacts";
import { resolveBlockedScreen, type BlockedScreenInput } from "@/lib/billing/blocked-screen";

interface SubscriptionBlockedViewProps {
  screen: BlockedScreenInput;
}

export function SubscriptionBlockedView({ screen }: SubscriptionBlockedViewProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { kind, title, description, actions } = resolveBlockedScreen(screen);
  const Icon = kind === "payment" ? CreditCard : AlertTriangle;

  const handleUpdatePayment = async () => {
    if (!user) return;
    setIsOpeningPortal(true);
    try {
      const result = await StripeService.createPortalSession({ userId: user.id });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      throw new Error("Portal sem endereço");
    } catch {
      toast.error("Não foi possível abrir o pagamento. Fale com a ProOps.");
      setIsOpeningPortal(false);
    }
  };

  const handleContact = () => {
    window.open(
      buildWhatsAppHref(SUPPORT_WHATSAPP_DIGITS, "Olá! O acesso da minha empresa à ProOps está suspenso."),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full" data-testid="subscription-blocked-card">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <Icon className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {actions.includes("renew") && (
            <Button onClick={() => router.push("/subscription-blocked/plans")} className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              Renovar assinatura
            </Button>
          )}

          {actions.includes("subscribe") && (
            <Button
              onClick={() => router.push("/subscription-blocked/plans")}
              variant="outline"
              className="w-full"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Assinar pelo cartão
            </Button>
          )}

          {actions.includes("update_payment") && (
            <Button
              onClick={handleUpdatePayment}
              disabled={isOpeningPortal || !user}
              variant="outline"
              className="w-full"
            >
              {isOpeningPortal ? (
                <>
                  <Loader size="sm" variant="button" className="mr-2" />
                  Abrindo...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Atualizar pagamento
                </>
              )}
            </Button>
          )}

          {actions.includes("contact") && (
            <Button
              variant={actions[0] === "contact" ? "default" : "outline"}
              className="w-full"
              onClick={handleContact}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com a ProOps
            </Button>
          )}

          {actions.includes("login") && (
            <Button
              variant={actions[0] === "login" ? "default" : "outline"}
              className="w-full"
              onClick={() => router.push("/login")}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Entrar
            </Button>
          )}

          {actions.includes("logout") && (
            <Button
              variant={actions[0] === "logout" ? "default" : "ghost"}
              className="w-full"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader size="sm" variant="button" className="mr-2" />
                  Saindo...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair da conta
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
