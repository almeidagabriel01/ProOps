"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, Package, UserPlus, HardDrive, Sparkles, ArrowRight, Infinity } from "lucide-react";
import { usePlanUsage, UsePlanUsageReturn } from "@/hooks/usePlanUsage";
import { cn } from "@/lib/utils";
import { Loader } from "@/components/ui/loader";

interface PlanUsageCardProps {
  variant?: "compact" | "detailed" | "inline" | "profile";
  className?: string;
  data?: UsePlanUsageReturn;
}

const resourceIcons = {
  Propostas: FileText,
  Clientes: Users,
  Produtos: Package,
  Membros: UserPlus,
  Armazenamento: HardDrive,
};

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function getTextColor(percentage: number): string {
  if (percentage >= 90) return "text-red-600 dark:text-red-400";
  if (percentage >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

interface UsageItemProps {
  label: string;
  current: number;
  limit: number;
  percentage: number;
  isUnlimited: boolean;
  compact?: boolean;
}

function UsageItem({
  label,
  current,
  limit,
  percentage,
  isUnlimited,
  compact,
}: UsageItemProps) {
  const Icon = resourceIcons[label as keyof typeof resourceIcons] || FileText;

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-muted rounded-lg">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium truncate">{label}</span>
            <span
              className={cn(
                "text-xs font-bold",
                isUnlimited ? "text-primary" : getTextColor(percentage)
              )}
            >
              {isUnlimited ? (
                <Infinity className="w-3 h-3 inline" />
              ) : (
                `${current}/${limit}`
              )}
            </span>
          </div>
          {!isUnlimited && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  getProgressColor(percentage)
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-muted rounded-lg">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="font-medium text-sm">{label}</span>
        </div>
        <div className="text-right">
          {isUnlimited ? (
            <Badge variant="secondary" className="gap-1">
              <Infinity className="w-3 h-3" />
              Ilimitado
            </Badge>
          ) : (
            <span className={cn("font-bold text-sm", getTextColor(percentage))}>
              {current} / {limit}
            </span>
          )}
        </div>
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              getProgressColor(percentage)
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function PlanUsageCard({
  variant = "detailed",
  className,
  data,
}: PlanUsageCardProps) {
  // Use provided data or fetch from hook
  const hookData = usePlanUsage();
  const {
    proposals,
    clients,
    products,
    users,
    isLoading,
    overallPercentage,
    criticalItems,
  } = data || hookData;

  // Don't show loading spinner for profile variant - page skeleton handles it
  if (isLoading && variant !== "profile") {
    return (
      <Card className={cn("", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader size="md" />
        </CardContent>
      </Card>
    );
  }

  const usageItems = [proposals, clients, products, users];

  if (variant === "profile") {
    return (
      <Card className={cn("flex flex-col", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="w-5 h-5 text-primary" />
              Uso do Plano
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Acompanhe seu consumo de recursos.
            </p>
          </div>
          {criticalItems.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {criticalItems.length} no limite
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {usageItems.map((item, index) => (
            <UsageItem key={index} {...item} />
          ))}
          <div className="pt-4 border-t mt-auto">
            <Link href="/profile?tab=billing">
              <Button variant="outline" className="w-full gap-2">
                <Sparkles className="w-4 h-4" />
                Ver planos
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === "inline") {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">Uso do Plano</span>
          </div>
          {criticalItems.length > 0 ? (
            <Badge variant="destructive" className="text-xs">
              {criticalItems.length} no limite
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
            >
              {overallPercentage}%
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {usageItems.map((item, index) => (
            <UsageItem key={index} {...item} compact />
          ))}
        </div>
        <Link href="/profile?tab=billing">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs gap-1 h-7 mt-1"
          >
            Ver detalhes da assinatura
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <Card
        className={cn(
          "shadow-md bg-gradient-to-br from-background to-violet-50/30 dark:to-violet-950/10 border border-border/50 relative overflow-hidden h-fit",
          className
        )}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl" />
        <CardHeader className="pb-2 pt-4 relative z-10">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400">
                <Sparkles className="w-4 h-4" />
              </div>
              Uso do Plano
            </div>
            {criticalItems.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalItems.length} no limite
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 relative z-10 pb-4">
          {usageItems.map((item, index) => (
            <UsageItem key={index} {...item} compact />
          ))}
          <Link href="/profile?tab=subscription" className="block pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs gap-1 h-8"
            >
              Ver planos
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Detailed variant
  return (
    <Card
      className={cn(
        "shadow-lg bg-gradient-to-br from-background to-violet-50/30 dark:to-violet-950/10 border border-border/50 relative overflow-hidden",
        className
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-3xl" />
      <CardHeader className="relative z-10">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-xl text-violet-600 dark:text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            Uso do Plano
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "font-medium",
              overallPercentage >= 80
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
            )}
          >
            {overallPercentage}% utilizado
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        {usageItems.map((item, index) => (
          <UsageItem key={index} {...item} />
        ))}

        {criticalItems.length > 0 && (
          <div className="pt-4 border-t">
            <Link href="/profile?tab=billing">
              <Button className="w-full gap-2" size="sm">
                <Sparkles className="w-4 h-4" />
                Fazer Upgrade
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
