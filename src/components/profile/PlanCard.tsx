import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Zap, Building, Check, Loader2 } from "lucide-react";
import { UserPlan, BillingInterval } from "@/types";
import { TIER_COLORS } from "@/types/plan";
import { formatPrice, formatLimit } from "@/utils/format";
import { cn } from "@/lib/utils";

const tierIcons: Record<string, React.ElementType> = {
  starter: Zap,
  pro: Crown,
  enterprise: Building,
};

interface PlanCardProps {
  plan: UserPlan;
  billingInterval: BillingInterval;
  isCurrent: boolean;
  canUpgrade: boolean;
  isProcessing: boolean;
  processingTier: string | null;
  onUpgrade: (plan: UserPlan) => void;
  onDowngrade: (plan: UserPlan) => void;
}

export function PlanCard({
  plan,
  billingInterval,
  isCurrent,
  canUpgrade,
  isProcessing,
  processingTier,
  onUpgrade,
  onDowngrade,
}: PlanCardProps) {
  const Icon = tierIcons[plan.tier];

  // Get display price based on billing interval
  const displayPrice =
    billingInterval === "yearly" && plan.pricing
      ? plan.pricing.yearly
      : plan.pricing?.monthly || plan.price;

  const monthlyEquivalent =
    billingInterval === "yearly" && plan.pricing
      ? Math.round(plan.pricing.yearly / 12)
      : null;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 flex flex-col",
        isCurrent && "ring-2 ring-primary shadow-lg",
        !isCurrent && "hover:shadow-lg hover:scale-[1.02]",
        plan.highlighted && !isCurrent && "ring-2 ring-emerald-500/50"
      )}
    >
      {/* Current Plan Badge */}
      {isCurrent && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-center py-1 text-xs font-semibold">
          Plano Atual
        </div>
      )}

      {/* Popular Badge (only if not current) */}
      {plan.highlighted && !isCurrent && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-center py-1 text-xs font-semibold">
          Mais Popular
        </div>
      )}

      <CardHeader
        className={cn(
          "text-center pb-2",
          (isCurrent || plan.highlighted) && "pt-8"
        )}
      >
        <div
          className={cn(
            "h-12 w-12 mx-auto rounded-xl bg-gradient-to-br flex items-center justify-center mb-2",
            TIER_COLORS[plan.tier]
          )}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <CardTitle className="text-lg">{plan.name}</CardTitle>
        <CardDescription className="text-xs min-h-[32px]">
          {plan.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-0 flex-1">
        {/* Price */}
        <div className="text-center">
          {billingInterval === "yearly" && plan.pricing && (
            <div className="text-sm text-muted-foreground line-through mb-1">
              {formatPrice(plan.pricing.monthly * 12)}/ano
            </div>
          )}
          <span className="text-2xl font-bold">
            {formatPrice(displayPrice)}
          </span>
          {displayPrice > 0 && (
            <span className="text-muted-foreground text-sm">
              {billingInterval === "yearly" ? "/ano" : "/mês"}
            </span>
          )}
          {monthlyEquivalent && (
            <div className="text-sm text-emerald-600 mt-1">
              Equivale a {formatPrice(monthlyEquivalent)}/mês
            </div>
          )}
        </div>

        {/* Features */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Propostas</span>
            <span className="font-medium">
              {formatLimit(plan.features.maxProposals)}
              {plan.features.maxProposals > 0 && "/mês"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Clientes</span>
            <span className="font-medium">
              {formatLimit(plan.features.maxClients)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Usuários</span>
            <span className="font-medium">
              {formatLimit(plan.features.maxUsers)}
            </span>
          </div>

          {/* Boolean features */}
          <div className="pt-2 border-t space-y-1">
            {plan.features.hasFinancial && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Check className="w-3 h-3" />
                <span>Financeiro</span>
              </div>
            )}
            {plan.features.canCustomizeTheme && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Check className="w-3 h-3" />
                <span>Personalização</span>
              </div>
            )}
            {plan.features.canEditPdfSections && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <Check className="w-3 h-3" />
                <span>Editor PDF</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <div className="p-4 pt-0 mt-auto">
        {isCurrent ? (
          <Button className="w-full" size="sm" variant="secondary" disabled>
            Plano Atual
          </Button>
        ) : canUpgrade ? (
          <Button
            className="w-full"
            size="sm"
            onClick={() => onUpgrade(plan)}
            disabled={isProcessing}
          >
            {processingTier === plan.tier ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Fazer Upgrade"
            )}
          </Button>
        ) : (
          <Button
            className="w-full"
            size="sm"
            variant="outline"
            onClick={() => onDowngrade(plan)}
            disabled={isProcessing}
          >
            {processingTier === plan.tier ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Fazer Downgrade"
            )}
          </Button>
        )}
      </div>
    </Card>
  );
}
