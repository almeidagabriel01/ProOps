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
import { AddonService, ADDON_DEFINITIONS } from "@/services/addon-service";
import { BillingInterval, AddonType, AddonDefinition } from "@/types";
import { ArrowLeft, Puzzle, Sparkles, CreditCard, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { BillingToggle } from "@/components/ui/billing-toggle";
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
    refreshAddons,
    isLoading: isPlanLoading,
    planTier,
  } = usePlanLimits();

  // Get dynamic prices from Stripe
  const { getAddonPrice, isLoading: isPriceLoading } = useStripePrices();

  const [billingInterval, setBillingInterval] =
    React.useState<BillingInterval>("monthly");
  const [isProcessing, setIsProcessing] = React.useState<AddonType | null>(
    null
  );

  // Confirmation dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedAddon, setSelectedAddon] =
    React.useState<AddonDefinition | null>(null);

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [addonToCancel, setAddonToCancel] =
    React.useState<AddonDefinition | null>(null);

  // Handle canceled URL param and addon_cancelled param
  React.useEffect(() => {
    const canceled = searchParams.get("canceled");
    const addonCancelled = searchParams.get("addon_cancelled");

    if (canceled === "true") {
      toast.error("Pagamento cancelado. Nenhuma alteração foi feita.", {
        toastId: "addon-payment-canceled",
      });
      router.replace("/profile/addons");
    }

    if (addonCancelled === "true") {
      toast.success("Add-on cancelado com sucesso!", {
        toastId: "addon-cancelled-success",
      });
      router.replace("/profile/addons");
    }
  }, [searchParams, router]);

  // Get available add-ons for user's tier (now using the correct tier from hook)
  const availableAddons = AddonService.getAvailableAddonsForTier(planTier);

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
      // Call Stripe checkout endpoint
      const response = await fetch("/api/stripe/addon-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id,
          tenantId: tenant?.id,
          addonType: selectedAddon.id,
          userEmail: user?.email,
          billingInterval,
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        console.error("No checkout URL returned:", data);
        setIsProcessing(null);
      }
    } catch (error) {
      console.error("Error purchasing add-on:", error);
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
    setCancelDialogOpen(false);

    try {
      await AddonService.updateAddonStatus(
        tenant?.id || "",
        addonToCancel.id,
        "cancelled"
      );

      // Reload page with query param to show toast after reload
      window.location.href = "/profile/addons?addon_cancelled=true";
    } catch (error) {
      console.error("Error cancelling add-on:", error);
      toast.error("Erro ao cancelar add-on. Tente novamente.", {
        toastId: "addon-cancel-error",
      });
      setIsProcessing(null);
    }
  };

  if (isPlanLoading) {
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

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <BillingToggle
          id="addon-billing-toggle"
          value={billingInterval}
          onChange={setBillingInterval}
        />
      </div>

      {/* Add-ons Grid */}
      {availableAddons.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {availableAddons.map((addon) => {
            const purchasedData = purchasedAddonsData.find(
              (a) => a.addonType === addon.id
            );
            return (
              <AddonCard
                key={addon.id}
                addon={addon}
                isPurchased={purchasedAddons.includes(addon.id)}
                purchasedBillingInterval={purchasedData?.billingInterval}
                billingInterval={billingInterval}
                onPurchase={() => handlePurchaseClick(addon.id)}
                onCancel={() => handleCancelClick(addon.id)}
                isLoading={isProcessing === addon.id}
                dynamicPriceMonthly={getAddonPrice(addon.id, "monthly")}
                dynamicPriceYearly={getAddonPrice(addon.id, "yearly")}
              />
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">
            Você já tem acesso a tudo!
          </h3>
          <p className="text-muted-foreground">
            Seu plano atual já inclui todas as funcionalidades disponíveis.
          </p>
        </Card>
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

                const isRedundant = !availableAddons.find(
                  (a) => a.id === addonType
                );
                const purchasedData = purchasedAddonsData.find(
                  (a) => a.addonType === addonType
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
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{addon.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            Ativo
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {addon.description}
                        </p>
                        {purchasedData && (
                          <p className="text-xs text-muted-foreground mt-1 capitalize">
                            Cobrança:{" "}
                            {purchasedData.billingInterval === "yearly"
                              ? "Anual"
                              : "Mensal"}
                          </p>
                        )}
                        {isRedundant && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit border border-amber-200">
                            <Sparkles className="w-3 h-3" />
                            Já incluso no seu plano atual
                          </div>
                        )}
                      </div>
                    </div>

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
        billingInterval={billingInterval}
        priceMonthly={
          selectedAddon ? getAddonPrice(selectedAddon.id, "monthly") : 0
        }
        priceYearly={
          selectedAddon ? getAddonPrice(selectedAddon.id, "yearly") : 0
        }
        isProcessing={isProcessing !== null}
        onConfirm={handleConfirmPurchase}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Add-on?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o add-on{" "}
              <strong>{addonToCancel?.name}</strong>?
              <br />
              <br />
              Você perderá acesso às funcionalidades extras imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
