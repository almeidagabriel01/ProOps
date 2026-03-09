import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles, Zap, Star } from "lucide-react";
import { UserPlan, BillingInterval } from "@/types";
import { formatPrice } from "@/utils/format";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  plan: UserPlan;
  billingInterval: BillingInterval;
  isCurrent: boolean;
  canUpgrade: boolean;
  isProcessing: boolean;
  processingTier: string | null;
  onUpgrade: (plan: UserPlan) => void;
  onDowngrade: (plan: UserPlan) => void;
  isMaster?: boolean;
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
  isMaster = false,
}: PlanCardProps) {
  const displayPrice =
    billingInterval === "yearly" && plan.pricing
      ? plan.pricing.yearly
      : plan.pricing?.monthly || plan.price;

  const isEnterprise =
    plan.tier === "enterprise" ||
    ((plan.pricing?.monthly || plan.price) <= 0 &&
      (plan.pricing?.yearly || 0) <= 0);

  const monthlyEquivalent =
    billingInterval === "yearly" && plan.pricing
      ? plan.pricing.yearly / 12
      : null;

  const isPopular = plan.highlighted && !isCurrent;

  return (
    <div
      className={cn(
        "relative group rounded-xl p-[1px] transition-transform duration-300",
        // Animated Border Wrapper for highlighted cards
        isCurrent || isPopular ? "overflow-hidden" : "",
      )}
    >
      {/* Spinning Border Gradient for Active/Popular - Optimized */}
      {(isCurrent || isPopular) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300%] aspect-square animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0_340deg,var(--primary)_360deg)] opacity-70 will-change-transform" />
      )}

      {/* Main Card Content */}
      <Card
        className={cn(
          "relative flex flex-col h-full overflow-hidden rounded-xl border-0 bg-background transition-colors duration-200",
          !isCurrent &&
            !isPopular &&
            "border border-border/40 hover:border-primary/50 hover:shadow-lg hover:-translate-y-1",
          isCurrent && "inner-shadow-primary",
        )}
      >
        {/* Subtle Inner Glow */}
        {isCurrent && (
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
        )}
        {isPopular && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
        )}

        {/* Header Badges */}
        <div className="absolute top-0 right-0 p-4 z-20 flex gap-2">
          {isCurrent && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Ativo
            </span>
          )}
          {isPopular && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm">
              <Star className="w-3 h-3 fill-current" />
              Popular
            </span>
          )}
        </div>

        <CardHeader className="pt-8 pb-6 px-6 z-10">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                isCurrent
                  ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
                  : "bg-muted text-muted-foreground",
                isPopular &&
                  !isCurrent &&
                  "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
              )}
            >
              {isPopular ? (
                <Sparkles className="w-6 h-6" />
              ) : (
                <Zap className="w-6 h-6" />
              )}
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
                {plan.name}
              </CardTitle>
              {isCurrent && (
                <p className="text-xs font-medium text-primary mt-0.5">
                  Seu plano atual
                </p>
              )}
            </div>
          </div>
          <CardDescription className="text-sm leading-relaxed min-h-[40px]">
            {plan.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-8 flex-1 flex flex-col gap-6 z-10">
          {/* Price */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50 backdrop-blur-sm">
            {isMaster ? (
              <div className="flex flex-col">
                {isEnterprise ? (
                  <div className="flex items-center justify-center h-10 text-2xl font-extrabold tracking-tight text-foreground text-center w-full">
                    Sob consulta
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {formatPrice(displayPrice)}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                      /{billingInterval === "yearly" ? "ano" : "mês"}
                    </span>
                  </div>
                )}
                {billingInterval === "yearly" &&
                  monthlyEquivalent !== null &&
                  monthlyEquivalent > 0 &&
                  !isEnterprise && (
                    <div className="mt-2 text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30">
                        Economia anual (15% OFF)
                      </span>
                      <span>apenas {formatPrice(monthlyEquivalent)}/mês</span>
                    </div>
                  )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-10 text-muted-foreground text-sm font-medium">
                Consulte o admin
              </div>
            )}
          </div>

          {/* Features */}
          <div className="space-y-4 flex-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">
              Benefícios
            </p>
            <div className="grid gap-3">
              <FeatureRow
                label="Propostas comerciais"
                value={
                  plan.features.maxProposals === -1
                    ? "Ilimitadas"
                    : `Até ${plan.features.maxProposals}/mês`
                }
                highlight={true}
              />
              <FeatureRow
                label="Clientes cadastrados"
                value={
                  plan.features.maxClients === -1
                    ? "Ilimitados"
                    : `Até ${plan.features.maxClients}`
                }
              />
              <FeatureRow
                label="Produtos para venda"
                value={
                  plan.features.maxProducts === -1
                    ? "Ilimitados"
                    : `Até ${plan.features.maxProducts}`
                }
              />
              <FeatureRow
                label="Membros da equipe"
                value={
                  plan.features.maxUsers === -1
                    ? "Ilimitados"
                    : `Até ${plan.features.maxUsers}`
                }
              />
              <FeatureRow
                label="Layouts de proposta"
                value={
                  plan.features.maxPdfTemplates === -1
                    ? "Todos"
                    : `${plan.features.maxPdfTemplates}`
                }
              />
              <FeatureRow
                label="Fotos por produto"
                value={`Até ${plan.features.maxImagesPerProduct}`}
              />
              <FeatureRow
                label="Espaço para arquivos"
                value={
                  plan.features.maxStorageMB === -1
                    ? "Ilimitado"
                    : plan.features.maxStorageMB >= 1000
                      ? `${(plan.features.maxStorageMB / 1024).toFixed(1)} GB`
                      : `${plan.features.maxStorageMB} MB`
                }
              />
              <BooleanFeature
                label="Controle financeiro"
                available={plan.features.hasFinancial}
              />
              <BooleanFeature
                label="Cores personalizadas"
                available={plan.features.canCustomizeTheme}
              />
              <BooleanFeature
                label="Editor de PDF avançado"
                available={plan.features.canEditPdfSections}
              />
              <BooleanFeature
                label="CRM Kanban"
                available={plan.features.hasKanban}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto pt-2">
            {isCurrent ? (
              <Button
                className="w-full h-12 rounded-xl text-muted-foreground bg-muted/50 hover:bg-muted/70 border border-border/50"
                variant="ghost"
                disabled
              >
                Plano Ativo
              </Button>
            ) : isMaster ? (
              canUpgrade ? (
                <Button
                  className={cn(
                    "w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]",
                    isPopular
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground",
                  )}
                  onClick={() => onUpgrade(plan)}
                  disabled={isProcessing}
                >
                  {processingTier === plan.tier ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "Fazer Upgrade Agora"
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full h-12 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                  variant="outline"
                  onClick={() => onDowngrade(plan)}
                  disabled={isProcessing}
                >
                  {processingTier === plan.tier
                    ? "Processando..."
                    : "Mudar para este plano"}
                </Button>
              )
            ) : (
              <Button
                className="w-full h-12 rounded-xl"
                variant="secondary"
                disabled
              >
                Apenas Admin
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FeatureRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm group/row">
      <div className="flex items-center gap-3 text-muted-foreground group-hover/row:text-foreground transition-colors">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            highlight ? "bg-primary" : "bg-muted-foreground/40",
          )}
        />
        {label}
      </div>
      <span
        className={cn(
          "font-semibold",
          highlight ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function BooleanFeature({
  label,
  available,
}: {
  label: string;
  available: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 text-sm group/row",
        !available && "opacity-40 grayscale",
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center shrink-0 border",
          available
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
            : "border-muted bg-muted/50 text-muted-foreground",
        )}
      >
        <Check className="w-3 h-3" />
      </div>
      <span
        className={cn(
          "transition-colors",
          available
            ? "text-foreground"
            : "text-muted-foreground line-through decoration-muted-foreground/50",
        )}
      >
        {label}
      </span>
    </div>
  );
}
