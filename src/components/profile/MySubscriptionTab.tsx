"use client";

import { useState } from "react";
import { toast } from "react-toastify";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, UserPlan, PurchasedAddon, PlanFeatures } from "@/types";
import { ADDON_DEFINITIONS } from "@/services/addon-service";
import { DEFAULT_PLANS } from "@/services/plan-service";
import Link from "next/link";
import { formatPrice } from "@/utils/format";
import {
  CreditCard,
  Calendar,
  Crown,
  Puzzle,
  Check,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  Zap,
  RefreshCw,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MySubscriptionTabProps {
  user: User | null;
  userPlan: UserPlan | null;
  purchasedAddons: string[];
  addonsData: PurchasedAddon[];
  handleManagePayment: () => void;
  openingPortal: boolean;
  isMaster: boolean;
}

const statusLabels: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "destructive" }
> = {
  active: { label: "Ativa", variant: "success" },
  trialing: { label: "Trial", variant: "warning" },
  past_due: { label: "Pagamento Pendente", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "destructive" },
  unpaid: { label: "Não Pago", variant: "destructive" },
  free: { label: "Gratuito", variant: "default" },
  inactive: { label: "Inativa", variant: "default" },
};

// Features to display
const featuresList: {
  key: keyof PlanFeatures;
  label: string;
  format: (val: number | boolean) => string;
}[] = [
    {
      key: "maxProposals",
      label: "Propostas/mês",
      format: (v) => (v === -1 ? "Ilimitadas" : String(v)),
    },
    {
      key: "maxClients",
      label: "Clientes",
      format: (v) => (v === -1 ? "Ilimitados" : String(v)),
    },
    {
      key: "maxProducts",
      label: "Produtos",
      format: (v) => (v === -1 ? "Ilimitados" : String(v)),
    },
    {
      key: "maxUsers",
      label: "Usuários",
      format: (v) => (v === -1 ? "Ilimitados" : String(v)),
    },
    {
      key: "hasFinancial",
      label: "Módulo Financeiro",
      format: (v) => (v ? "Incluso" : "Não incluso"),
    },
    {
      key: "canCustomizeTheme",
      label: "Personalização de cores",
      format: (v) => (v ? "Sim" : "Não"),
    },
    {
      key: "maxPdfTemplates",
      label: "Templates PDF",
      format: (v) => (v === -1 ? "Todos" : String(v)),
    },

    {
      key: "canEditPdfSections",
      label: "Editor PDF avançado",
      format: (v) => (v ? "Sim" : "Não"),
    },
  ];

export function MySubscriptionTab({
  user,
  userPlan,
  purchasedAddons,
  addonsData,
  handleManagePayment,
  openingPortal,
  isMaster,
}: MySubscriptionTabProps) {
  // Get effective plan - fallback to DEFAULT_PLANS if userPlan is null but user has planId
  const effectivePlan =
    userPlan ||
    (() => {
      if (user?.planId) {
        const defaultPlan = DEFAULT_PLANS.find((p) => p.tier === user.planId);
        if (defaultPlan) {
          return { ...defaultPlan, id: defaultPlan.tier } as UserPlan;
        }
      }
      return null;
    })();

  // Infer subscription status - if user has a plan assigned, assume active
  const rawSubscriptionStatus = user?.subscriptionStatus;
  const hasPlanAssigned = !!user?.planId || !!effectivePlan;
  const subscriptionStatus =
    rawSubscriptionStatus || (hasPlanAssigned ? "active" : "free");

  const currentPeriodEnd = user?.currentPeriodEnd;
  const billingInterval = user?.billingInterval || "monthly";
  const cancelAtPeriodEnd = user?.cancelAtPeriodEnd;
  const isManualSubscription = user?.isManualSubscription;
  const hasStripeSubscription = !!user?.stripeSubscriptionId;

  const [isSyncing, setIsSyncing] = useState(false);
  const [addonToCancel, setAddonToCancel] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [subscriptionToCancel, setSubscriptionToCancel] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);

  const handleConfirmCancel = async () => {
    if (!addonToCancel) return;
    setIsCancelling(true);
    try {
      const { StripeService } = await import("@/services/stripe-service");
      await StripeService.cancelAddon({
        addonId: addonToCancel,
        tenantId: user?.tenantId,
      });
      toast.success(
        "Módulo cancelado com sucesso. A alteração será refletida em breve."
      );
      setAddonToCancel(null);
      // Optional: Trigger a refresh or sync
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error("Error cancelling addon:", error);
      toast.error("Erro ao cancelar módulo. Tente novamente.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { StripeService } = await import("@/services/stripe-service");
      const response = await StripeService.syncSubscription();
      if (response.success) {
        toast.success("Assinatura sincronizada com sucesso!");
        window.location.reload();
      } else {
        throw new Error("Falha na sincronização");
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erro ao sincronizar assinatura.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmCancelSubscription = async () => {
    setIsCancellingSubscription(true);
    try {
      const { StripeService } = await import("@/services/stripe-service");
      const result = await StripeService.cancelSubscription();
      if (result.success) {
        toast.success(
          "Cancelamento agendado! Seu acesso continua até o final do período pago."
        );
        setSubscriptionToCancel(false);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        throw new Error("Falha no cancelamento");
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error("Erro ao cancelar assinatura. Tente novamente.");
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  // Show billing info only for real Stripe subscriptions (not manual ones)
  // Data comes from Stripe webhooks - no hardcoded tier checks
  const showBillingInfo =
    !isManualSubscription && hasStripeSubscription && currentPeriodEnd;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const statusInfo = statusLabels[subscriptionStatus] || statusLabels.active;

  // Calculate monthly price (using effectivePlan)
  const monthlyPrice =
    effectivePlan?.pricing?.monthly || effectivePlan?.price || 0;
  const yearlyPrice = effectivePlan?.pricing?.yearly || 0;
  const currentPrice =
    billingInterval === "yearly" ? yearlyPrice : monthlyPrice;

  // Get addon details
  const getAddonName = (addonId: string): string => {
    const addon = ADDON_DEFINITIONS.find((a) => a.id === addonId);
    return addon?.name || addonId;
  };

  if (!isMaster) {
    return (
      <Card className="bg-muted/30 border-dashed">
        <CardHeader className="text-center pb-10 pt-10">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <CreditCard className="w-6 h-6 text-muted-foreground" />
          </div>
          <CardTitle>Acesso Restrito</CardTitle>
          <p className="text-muted-foreground max-w-md mx-auto mt-2">
            Apenas o administrador da conta pode visualizar detalhes de
            faturamento.
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Subscription Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Crown className="w-7 h-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">
                    {effectivePlan?.name || "Plano Gratuito"}
                  </h2>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  {isManualSubscription && (
                    <Badge variant="secondary" className="text-xs">
                      Manual
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  {isManualSubscription
                    ? "Gerenciado pelo administrador"
                    : billingInterval === "yearly"
                      ? "Cobrança anual"
                      : "Cobrança mensal"}
                </p>
              </div>
            </div>

            {/* Price */}
            {currentPrice > 0 && (
              <div className="text-right">
                <div className="text-3xl font-bold">
                  {formatPrice(currentPrice)}
                </div>
                <p className="text-sm text-muted-foreground">
                  /{billingInterval === "yearly" ? "ano" : "mês"}
                </p>
              </div>
            )}
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Billing Info - only for Stripe subscriptions */}
          {showBillingInfo && (
            <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-muted/50 border">
              <div className="flex items-center gap-3 flex-1">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Próxima cobrança
                  </p>
                  <p className="font-semibold">
                    {formatDate(currentPeriodEnd)}
                  </p>
                </div>
              </div>

              {cancelAtPeriodEnd && (
                <div className="flex items-center gap-3 flex-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-amber-600">
                      Cancelamento agendado
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Acesso até {formatDate(currentPeriodEnd)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sync Button for missing billing info */}
          {!isManualSubscription &&
            hasStripeSubscription &&
            !currentPeriodEnd && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3 flex-1">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-amber-600">
                      Data de cobrança não disponível
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sincronize sua assinatura para atualizar os dados.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="shrink-0"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  Sincronizar
                </Button>
              </div>
            )}

          {/* What's Included */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              O que está incluso no seu plano
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {effectivePlan &&
                featuresList.map((feature) => {
                  const value = effectivePlan.features[feature.key];
                  const isBoolean = typeof value === "boolean";
                  const isAvailable = isBoolean
                    ? value
                    : (value as number) > 0 || (value as number) === -1;

                  return (
                    <div
                      key={feature.key}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${isAvailable ? "bg-card" : "bg-muted/30 opacity-60"
                        }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${isAvailable
                          ? "bg-green-500/10 text-green-500"
                          : "bg-muted text-muted-foreground"
                          }`}
                      >
                        {isAvailable ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {feature.label}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-semibold ${isAvailable ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {feature.format(value)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Link href="/profile?tab=billing" className="flex-1">
              <Button variant="outline" className="w-full">
                <Zap className="w-4 h-4 mr-2" />
                Alterar Plano
              </Button>
            </Link>
            {effectivePlan && (
              <Button
                variant="default"
                className="flex-1"
                onClick={handleManagePayment}
                disabled={openingPortal}
              >
                {openingPortal ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Abrindo...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Gerenciar Pagamento
                    <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add-ons / Included Modules Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Puzzle className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Módulos Extras</CardTitle>
                <CardDescription>
                  Funcionalidades premium do seu plano
                </CardDescription>
              </div>
            </div>
            <Link href="/profile/addons">
              <Button variant="outline" size="sm">
                Ver Todos
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            // Build list of all active modules (from plan features + purchased addons)
            const includedModules: {
              id: string;
              name: string;
              description: string;
              source: "plan" | "addon";
            }[] = [];

            // Check features included in the plan
            if (effectivePlan?.features) {
              // Financial module
              if (effectivePlan.features.hasFinancial) {
                includedModules.push({
                  id: "financial",
                  name: "Módulo Financeiro",
                  description:
                    "Controle de receitas, despesas e fluxo de caixa",
                  source: purchasedAddons.includes("financial")
                    ? "addon"
                    : "plan",
                });
              }

              // PDF Editor Partial (3+ templates)
              if (
                effectivePlan.features.maxPdfTemplates >= 3 ||
                effectivePlan.features.maxPdfTemplates === -1
              ) {
                // Only show if NOT full editor
                if (
                  !effectivePlan.features.canEditPdfSections &&
                  effectivePlan.features.maxPdfTemplates !== -1
                ) {
                  includedModules.push({
                    id: "pdf_editor_partial",
                    name: "Editor PDF Parcial",
                    description: "Acesso a templates de PDF",
                    source: purchasedAddons.includes("pdf_editor_partial")
                      ? "addon"
                      : "plan",
                  });
                }
              }

              // PDF Editor Full
              if (
                effectivePlan.features.canEditPdfSections ||
                effectivePlan.features.maxPdfTemplates === -1
              ) {
                includedModules.push({
                  id: "pdf_editor_full",
                  name: "Editor PDF Completo",
                  description: "Todos os templates + edição de conteúdo",
                  source: purchasedAddons.includes("pdf_editor_full")
                    ? "addon"
                    : "plan",
                });
              }
            }

            // Add any purchased addons not already in the list
            purchasedAddons.forEach((addonId) => {
              if (!includedModules.find((m) => m.id === addonId)) {
                const addon = ADDON_DEFINITIONS.find((a) => a.id === addonId);
                if (addon) {
                  includedModules.push({
                    id: addonId,
                    name: addon.name,
                    description: addon.description,
                    source: "addon",
                  });
                }
              }
            });

            if (includedModules.length > 0) {
              return (
                <div className="space-y-3">
                  {includedModules.map((module) => (
                    <div
                      key={module.id}
                      className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                          <Puzzle className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                          <p className="font-semibold">{module.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {module.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={
                            module.source === "plan"
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-green-500/10 text-green-600 border-green-500/20"
                          }
                        >
                          <Check className="w-3 h-3 mr-1" />
                          {module.source === "plan"
                            ? "Incluso no plano"
                            : "Add-on ativo"}
                        </Badge>
                        {module.source === "addon" && (() => {
                          const addonInfo = addonsData.find(a => a.addonType === module.id);
                          const isCancelled = addonInfo?.cancelAtPeriodEnd;
                          const cancelDate = addonInfo?.currentPeriodEnd;

                          if (isCancelled) {
                            return (
                              <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
                                Cancelando {formatDate(cancelDate)}
                              </Badge>
                            );
                          }

                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setAddonToCancel(module.id)}
                            >
                              Cancelar
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div className="text-center py-8">
                <Puzzle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground mb-4">
                  Nenhum módulo contratado
                </p>
                <Link href="/profile/addons">
                  <Button variant="outline">Explorar Add-ons</Button>
                </Link>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Cancel Subscription Direct - only for Stripe subscriptions */}
      {effectivePlan && !cancelAtPeriodEnd && !isManualSubscription && (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1">
                  Precisa cancelar sua assinatura?
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Você pode cancelar a qualquer momento. Seu acesso continua até o fim do período pago.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSubscriptionToCancel(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                >
                  Cancelar Assinatura
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={!!addonToCancel}
        onOpenChange={(open) => !open && setAddonToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Módulo Extra?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja cancelar o módulo{" "}
              <strong>
                {addonToCancel ? getAddonName(addonToCancel) : ""}
              </strong>
              ?
              <br />
              <br />O acesso será revogado imediatamente e não haverá cobranças
              futuras para este item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Sim, cancelar módulo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscription Cancellation Dialog */}
      <AlertDialog
        open={subscriptionToCancel}
        onOpenChange={(open) => !isCancellingSubscription && setSubscriptionToCancel(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar sua assinatura do plano{" "}
              <strong>{effectivePlan?.name}</strong>?
              <br />
              <br />
              Seu acesso continuará ativo até o final do período já pago. Após essa data, você será movido para o plano gratuito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingSubscription}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancelSubscription();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isCancellingSubscription}
            >
              {isCancellingSubscription ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Sim, cancelar assinatura"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
