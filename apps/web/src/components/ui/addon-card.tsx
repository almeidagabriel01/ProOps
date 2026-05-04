"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddonDefinition } from "@/types";
import { DollarSign, FileEdit, Layout, Palette, Users, Check, Crown, Calendar } from "lucide-react";
import { useThemePrimaryColor } from "@/hooks/useThemePrimaryColor";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/utils/format";
import { Loader } from "@/components/ui/loader";

interface AddonCardProps {
  addon: AddonDefinition;
  isPurchased: boolean;
  onPurchase?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  // Dynamic price from Stripe (in cents) - REQUIRED, no fallback
  dynamicPriceMonthly?: number;
  isPriceLoading?: boolean;
  // Scheduled cancellation info
  isScheduledCancel?: boolean;
  cancelDate?: string;
  isIncluded?: boolean; // New prop
}

// Map icon names to Lucide components
const iconMap: Record<string, typeof DollarSign> = {
  DollarSign,
  FileEdit,
  Layout,
  Palette,
  Users,
};

export function AddonCard({
  addon,
  isPurchased,
  onPurchase,
  onCancel,
  isLoading = false,
  dynamicPriceMonthly,
  isPriceLoading = false,
  isScheduledCancel = false,
  cancelDate,
  isIncluded = false,
}: AddonCardProps) {
  const IconComponent = iconMap[addon.icon] || DollarSign;

  // Price comes from Stripe in CENTS
  const monthlyPrice =
    dynamicPriceMonthly !== undefined ? dynamicPriceMonthly : null;

  const primaryColor = useThemePrimaryColor();
  const accentColor = primaryColor;

  return (
    <Card
      className={`relative overflow-hidden transition-all hover:shadow-lg h-full flex flex-col ${
        isPurchased || isIncluded ? "ring-2" : ""
      }`}
      style={{
        borderColor: isPurchased || isIncluded ? primaryColor : undefined,
      }}
    >
      {(isPurchased || isIncluded) && (
        <div
          className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white`}
          style={{
            backgroundColor: isScheduledCancel ? "#ef4444" : primaryColor,
          }}
        >
          {isScheduledCancel ? (
            <>
              <Calendar className="w-3 h-3" />
              Cancela {cancelDate}
            </>
          ) : isIncluded && !isPurchased ? (
            <>
              <Check className="w-3 h-3" />
              Incluso
            </>
          ) : (
            <>
              <Check className="w-3 h-3" />
              Ativo
            </>
          )}
        </div>
      )}

      <CardContent className="p-6 flex-1">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <IconComponent className="w-6 h-6" style={{ color: accentColor }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg">{addon.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {addon.description}
            </p>

            {/* Pricing - from Stripe only */}
            <div className="mt-4 flex items-baseline gap-2">
              {isPriceLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : monthlyPrice !== null ? (
                <>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(monthlyPrice / 100)}
                  </span>
                  <span className="text-muted-foreground">/mês</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Preço indisponível
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Action Button Footer */}
      <div className="p-6 pt-0 mt-auto">
        {isPurchased && !isScheduledCancel ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="w-full"
          >
            Cancelar Add-on
          </Button>
        ) : isPurchased && isScheduledCancel ? (
          <div className="text-center text-xs text-muted-foreground">
            Ativo até {cancelDate}
          </div>
        ) : isIncluded ? (
          <Button
            variant="secondary"
            size="sm"
            disabled
            className="w-full gap-2 opacity-80"
          >
            <Check className="w-4 h-4" />
            Incluso no seu plano
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onPurchase}
            disabled={isLoading || monthlyPrice === null}
            className="w-full gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {isLoading ? (
              <Loader size="sm" />
            ) : (
              <>
                <Crown className="w-4 h-4" />
                Adicionar
              </>
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
