"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddonCard } from "@/components/ui/addon-card";
import { AddonConfirmDialog } from "@/components/ui/addon-confirm-dialog";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useStripePrices } from "@/hooks/useStripePrices";
import { ADDON_DEFINITIONS } from "@/services/addon-service";
import { AddonType, AddonDefinition, PlanTier } from "@/types";
import {
  ArrowLeft,
  Puzzle,
  Sparkles,
  CreditCard,
  Loader2,
  Calendar,
} from "lucide-react";
import { toast } from '@/lib/toast';
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
import { AddonsSkeleton } from "./_components/addons-skeleton";
import { formatDateBR } from "@/utils/date-format";

export default function AddonsPage() {
  // ...
  // (inside component)
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenant } = useTenant();
  const { user } = useAuth();
  const {
    purchasedAddons,
    purchasedAddonsData,
    isLoading: isPlanLoading,
    planTier,
  } = usePlanLimits();

  // Get dynamic prices from Stripe
  const { getAddonPrice, isLoading: isPriceLoading } = useStripePrices();

  const [isProcessing, setIsProcessing] = React.useState<AddonType | null>(
    null,
  );

  // Confirmation dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedAddon, setSelectedAddon] =
    React.useState<AddonDefinition | null>(null);

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [addonToCancel, setAddonToCancel] =
    React.useState<AddonDefinition | null>(null);

  const normalizeDate = (value: unknown): Date | null => {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value === "object") {
      const asObj = value as {
        toDate?: () => Date;
        seconds?: number;
      };

      if (typeof asObj.toDate === "function") {
        const parsed = asObj.toDate();
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      if (typeof asObj.seconds === "number") {
        const parsed = new Date(asObj.seconds * 1000);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
    }

    return null;
  };

  const addonToCancelData = addonToCancel
    ? purchasedAddonsData.find((a) => a.addonType === addonToCancel.id)
    : null;
  const addonToCancelDate =
    (addonToCancelData?.currentPeriodEnd
      ? formatDateBR(addonToCancelData.currentPeriodEnd)
      : null) ||
    (() => {
      const purchasedDate = normalizeDate(addonToCancelData?.purchasedAt);
      if (!purchasedDate) return null;
      const projected = new Date(purchasedDate);
      projected.setDate(projected.getDate() + 30);
      return formatDateBR(projected);
    })();

  // Handle success/canceled URL params - only after loading is complete
  React.useEffect(() => {
    // Wait until loading is done before showing toasts
    if (isPlanLoading || isPriceLoading) return;

    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    const addonCancelled = searchParams.get("addon_cancelled");
    const addonAlreadyActive = searchParams.get("addon_already_active");

    if (success === "true") {
      toast.success(
        "Pagamento realizado com sucesso! Seu add-on será ativado em instantes.",
        {
          toastId: "addon-payment-success",
        },
      );
      router.replace("/profile/addons");
    }

    if (canceled === "true") {
      toast.error("Pagamento cancelado. Nenhuma alteração foi feita.", {
        toastId: "addon-payment-canceled",
      });
      router.replace("/profile/addons");
    }

    if (addonCancelled === "true") {
      toast.success(
        "Cancelamento agendado! O add-on ficará ativo até o final do período pago.",
        {
          toastId: "addon-cancelled-success",
        },
      );
      router.replace("/profile/addons");
    }

    if (addonAlreadyActive === "true") {
      toast.success("Este add-on já estava ativo para sua conta.", {
        toastId: "addon-already-active",
      });
      router.replace("/profile/addons");
    }
  }, [searchParams, router, isPlanLoading, isPriceLoading]);

  // Show all add-ons regardless of tier, to allow viewing status/prices
  const availableAddons = React.useMemo(() => {
    return ADDON_DEFINITIONS;
  }, []);

  // Open confirmation dialog instead of going directly to checkout
  const handlePurchaseClick = (addonType: AddonType) => {
    const addon = ADDON_DEFINITIONS.find((a) => a.id === addonType);
    if (addon) {
      setSelectedAddon(addon);
      setDialogOpen(true);
    }
  };

  // Actually proceed to Stripe checkout
  const handleConfirmPurchase = async () => {
    if (!selectedAddon) return;

    setIsProcessing(selectedAddon.id);

    try {
      // Call Stripe checkout Cloud Function
      const { StripeService } = await import("@/services/stripe-service");
      const data = await StripeService.createAddonCheckout({
        userId: user?.id || "",
        addonId: selectedAddon.id, // Fixed: use addonId instead of addonType
        origin: window.location.origin,
      });

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.success) {
        window.location.href =
          "/profile/addons?addon_already_active=true";
      } else {
        console.error("No checkout URL returned:", data);
        toast.error("Erro ao gerar link de pagamento. Tente novamente.");
        setIsProcessing(null);
      }
    } catch (error) {
      console.error("Error purchasing add-on:", error);
      toast.error("Erro ao processar a solicitação. Tente novamente.");
      setIsProcessing(null);
    }
  };

  const handleCancelClick = (addonType: AddonType) => {
    const addon = ADDON_DEFINITIONS.find((a) => a.id === addonType);
    if (addon) {
      setAddonToCancel(addon);
      setCancelDialogOpen(true);
    }
  };

  const handleConfirmCancel = async () => {
    if (!addonToCancel) return;

    setIsProcessing(addonToCancel.id);
    // Keep dialog open while processing

    try {
      const { StripeService } = await import("@/services/stripe-service");
      await StripeService.cancelAddon({
        addonId: addonToCancel.id,
      });

      // Redirect with query param - toast will show after skeleton loading completes
      window.location.href = "/profile/addons?addon_cancelled=true";
    } catch (error) {
      console.error("Error cancelling add-on:", error);
      toast.error("Erro ao cancelar add-on. Tente novamente.", {
        toastId: "addon-cancel-error",
      });
      setIsProcessing(null);
    }
  };

  if (isPlanLoading || isPriceLoading) {
    return <AddonsSkeleton />;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/profile")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Puzzle className="w-6 h-6" />
            Módulos Add-on
          </h1>
          <p className="text-muted-foreground">
            Adicione funcionalidades extras ao seu plano
          </p>
        </div>
      </div>

      {/* Current Plan Info */}
      <Card className="mb-8">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${tenant?.primaryColor}20` }}
            >
              <Sparkles
                className="w-5 h-5"
                style={{ color: tenant?.primaryColor }}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Seu plano atual</p>
              <p className="font-semibold capitalize">{planTier}</p>
            </div>
          </div>
          <Link href="/profile">
            <Button variant="outline" size="sm">
              Gerenciar Plano
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Add-ons Grid */}
      {availableAddons.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {availableAddons.map((addon) => {
            const addonData = purchasedAddonsData.find(
              (a) => a.addonType === addon.id,
            );
            const isScheduledCancel = addonData?.cancelAtPeriodEnd === true;
            const cancelDate = addonData?.currentPeriodEnd
              ? formatDateBR(addonData.currentPeriodEnd)
              : undefined;

            // Check if included in current plan (if not available for purchase but we are on a higher tier)
            // Simple logic: if not in availableForTiers, assume included if we are on a known higher tier
            const normalizedTier = (planTier?.toLowerCase() ||
              "starter") as PlanTier;
            const isAvailableForPurchase =
              addon.availableForTiers.includes(normalizedTier);

            // Logic: Is Included if NOT available for purchase AND NOT purchased explicitly (to avoid double status)
            // But wait, if I purchased it, it is Purchased.
            // If I didn't purchase it, and it's not available, it is Included (assuming higher tier).
            // We need to be careful with "lower tier" case, but assuming upgrading path:
            let isIncluded = !isAvailableForPurchase;

            // Edge case: if plan is unknown, default to not included
            if (!["starter", "pro", "enterprise"].includes(normalizedTier)) {
              isIncluded = false;
            }

            // Verify hierarchy just in case (optional but safer)
            // Verify hierarchy just in case (optional but safer)

            // This is a heuristic. Ideally we check features.
            // But for now, relying on 'availableForTiers' logic (which implies "Upgrade Opportunities") is consistent with the Service.

            return (
              <AddonCard
                key={addon.id}
                addon={addon}
                isPurchased={purchasedAddons.includes(addon.id)}
                isIncluded={isIncluded && !purchasedAddons.includes(addon.id)}
                onPurchase={() => handlePurchaseClick(addon.id)}
                onCancel={() => handleCancelClick(addon.id)}
                isLoading={isProcessing === addon.id}
                dynamicPriceMonthly={getAddonPrice(addon.id, "monthly")}
                isPriceLoading={isPriceLoading}
                isScheduledCancel={isScheduledCancel}
                cancelDate={cancelDate}
              />
            );
          })}
        </div>
      )}

      {availableAddons.length === 0 && (
        <div className="text-center p-8 text-muted-foreground">
          Nenhum add-on disponível para visualização.
        </div>
      )}

      {/* Purchased Add-ons Summary */}
      {purchasedAddons.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Gerenciar Add-ons Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchasedAddons.map((addonType) => {
                const addon = ADDON_DEFINITIONS.find((a) => a.id === addonType);
                if (!addon) return null;

                const addonData = purchasedAddonsData.find(
                  (a) => a.addonType === addonType,
                );
                const isScheduledCancel = addonData?.cancelAtPeriodEnd === true;
                const cancelDate = addonData?.currentPeriodEnd
                  ? formatDateBR(addonData.currentPeriodEnd)
                  : null;

                const isRedundant = !availableAddons.find(
                  (a) => a.id === addonType,
                );

                return (
                  <div
                    key={addonType}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg bg-muted/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-background rounded-md border">
                        <Puzzle className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold">{addon.name}</h4>
                          {isScheduledCancel ? (
                            <Badge variant="destructive" className="text-xs">
                              Cancelando em {cancelDate}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Ativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {addon.description}
                        </p>
                        {isScheduledCancel && cancelDate && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit border border-amber-200">
                            <Calendar className="w-3 h-3" />
                            Ativo até {cancelDate}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Cobrança: Mensal
                        </p>
                        {isRedundant && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit border border-amber-200">
                            <Sparkles className="w-3 h-3" />
                            Já incluso no seu plano atual
                          </div>
                        )}
                      </div>
                    </div>

                    {!isScheduledCancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelClick(addonType)}
                        className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                        disabled={isProcessing === addonType}
                      >
                        {isProcessing === addonType ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Cancelar Assinatura"
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AddonConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        addon={selectedAddon}
        priceMonthly={
          selectedAddon ? getAddonPrice(selectedAddon.id, "monthly") : 0
        }
        isProcessing={isProcessing !== null}
        onConfirm={handleConfirmPurchase}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={cancelDialogOpen}
        onOpenChange={(open) => {
          // Prevent closing while processing
          if (!isProcessing) setCancelDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Add-on?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o add-on{" "}
              <strong>{addonToCancel?.name}</strong>?
              <br />
              <br />O add-on continuará ativo até{" "}
              <strong>{addonToCancelDate || "o final do período já pago"}</strong>.
              Após essa data, o acesso será revogado e não haverá renovação automática.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing !== null}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
              disabled={isProcessing !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing !== null ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Sim, cancelar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
