"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddonDefinition, AddonType, BillingInterval } from "@/types";
import {
  DollarSign,
  FileEdit,
  Layout,
  Palette,
  Users,
  Check,
  Crown,
} from "lucide-react";
import { useTenant } from "@/providers/tenant-provider";

interface AddonCardProps {
  addon: AddonDefinition;
  isPurchased: boolean;
  purchasedBillingInterval?: "monthly" | "yearly"; // The billing interval the addon was purchased with
  billingInterval: BillingInterval;
  onPurchase?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  // Dynamic price from Stripe (in cents) - if provided, overrides addon.pricing
  dynamicPriceMonthly?: number;
  dynamicPriceYearly?: number;
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
  purchasedBillingInterval,
  billingInterval,
  onPurchase,
  onCancel,
  isLoading = false,
  dynamicPriceMonthly,
  dynamicPriceYearly,
}: AddonCardProps) {
  const { tenant } = useTenant();
  const IconComponent = iconMap[addon.icon] || DollarSign;

  // Check if user can upgrade addon from monthly to yearly
  const canUpgradeToYearly =
    isPurchased &&
    purchasedBillingInterval === "monthly" &&
    billingInterval === "yearly";

  // Use dynamic prices from Stripe if available, otherwise fallback to hardcoded
  const monthlyPrice =
    dynamicPriceMonthly !== undefined
      ? dynamicPriceMonthly / 100
      : addon.pricing.monthly;
  const yearlyPrice =
    dynamicPriceYearly !== undefined
      ? dynamicPriceYearly / 100
      : addon.pricing.yearly;

  const price = billingInterval === "yearly" ? yearlyPrice / 12 : monthlyPrice;

  const totalYearly = yearlyPrice;
  const monthlyEquivalent = (totalYearly / 12).toFixed(0);

  // Helper to lighten color
  const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return (
      "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    );
  };

  const primaryColor = tenant?.primaryColor || "#2563eb";
  const accentColor = lightenColor(primaryColor, 20);

  return (
    <Card
      className={`relative overflow-hidden transition-all hover:shadow-lg h-full flex flex-col ${
        isPurchased ? "ring-2" : ""
      }`}
      style={{
        borderColor: isPurchased ? primaryColor : undefined,
      }}
    >
      {isPurchased && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <Check className="w-3 h-3" />
          Ativo
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

            {/* Pricing */}
            <div className="mt-4 flex items-baseline gap-2">
              <span
                className="text-2xl font-bold"
                style={{ color: primaryColor }}
              >
                R$ {price.toFixed(0)}
              </span>
              <span className="text-muted-foreground">/mês</span>
              {billingInterval === "yearly" && (
                <Badge variant="secondary" className="ml-2">
                  15% off
                </Badge>
              )}
            </div>

            {billingInterval === "yearly" && (
              <p className="text-xs text-muted-foreground mt-1">
                R$ {totalYearly.toFixed(0)}/ano (R$ {monthlyEquivalent}/mês)
              </p>
            )}
          </div>
        </div>
      </CardContent>

      {/* Action Button Footer */}
      <div className="p-6 pt-0 mt-auto">
        {isPurchased ? (
          canUpgradeToYearly ? (
            <Button
              size="sm"
              onClick={onPurchase}
              disabled={isLoading}
              className="w-full gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <Crown className="w-4 h-4" />
              Upgrade para Anual
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isLoading}
              className="w-full"
            >
              Cancelar Add-on
            </Button>
          )
        ) : (
          <Button
            size="sm"
            onClick={onPurchase}
            disabled={isLoading}
            className="w-full gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            <Crown className="w-4 h-4" />
            Adicionar
          </Button>
        )}
      </div>
    </Card>
  );
}
