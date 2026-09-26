"use client";

import * as React from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermissions } from "@/providers/permissions-provider";
import { formatMonthLabel } from "@/lib/month-key";
import { cn } from "@/lib/utils";
import { SalesGoalsService, type GoalProgress } from "@/services/sales-goals-service";

interface GoalsProgressCardProps {
  /** O mês escolhido no Dashboard ("AAAA-MM"). */
  month: string;
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/** Percentual atingido, ou null sem meta. Passa de 100 quando a meta é batida. */
export function goalPercent(achieved: number, target: number | null): number | null {
  if (!target || target <= 0) return null;
  return Math.round((achieved / target) * 100);
}

function ProgressRow({
  label,
  achieved,
  target,
  count,
  strong,
}: {
  label: string;
  achieved: number;
  target: number | null;
  count?: number;
  strong?: boolean;
}) {
  const percent = goalPercent(achieved, target);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className={cn("min-w-0 truncate", strong ? "font-semibold" : "font-medium")}>{label}</span>
        <span className="text-muted-foreground">
          {money(achieved)}
          {target ? ` de ${money(target)}` : ""}
          {percent !== null && (
            <span className={cn("ml-2 font-medium", percent >= 100 ? "text-emerald-600" : "text-foreground")}>
              {percent}%
            </span>
          )}
        </span>
      </div>
      {target ? (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label={`${label}: ${percent}% da meta`}
          aria-valuenow={Math.min(percent ?? 0, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn("h-full rounded-full", (percent ?? 0) >= 100 ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
          />
        </div>
      ) : null}
      {count !== undefined && count > 0 && (
        <p className="text-xs text-muted-foreground">
          {count === 1 ? "1 proposta aprovada" : `${count} propostas aprovadas`}
        </p>
      )}
    </div>
  );
}

/** A conta de demonstração não tem metas de verdade: mostra um exemplo, rotulado. */
const DEMO_PROGRESS: GoalProgress = {
  month: "",
  scope: "company",
  companyTarget: 80000,
  companyAchieved: 54300,
  companyCount: 3,
  people: [
    { id: "d1", name: "Equipe Demo", target: 50000, achieved: 41200, count: 2 },
    { id: "d2", name: "Vendedor de exemplo", target: 30000, achieved: 13100, count: 1 },
  ],
  unassignedAchieved: 0,
};

/**
 * Metas no Dashboard. O dono vê a empresa e cada vendedor; o membro, só o
 * próprio número (é o que a API devolve para ele).
 */
export function GoalsProgressCard({ month }: GoalsProgressCardProps) {
  const { hasSalesGoals, isLoading: planLoading } = usePlanLimits();
  const { isDemo, isMaster } = usePermissions();
  const [progress, setProgress] = React.useState<GoalProgress | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!hasSalesGoals || isDemo) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    SalesGoalsService.progress(month)
      .then((value) => {
        if (!cancelled) setProgress(value);
      })
      .catch(() => {
        if (!cancelled) setProgress(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasSalesGoals, isDemo, month]);

  if (planLoading || !hasSalesGoals) return null;
  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />;

  const data = isDemo ? DEMO_PROGRESS : progress;
  if (!data) return null;

  const title = `Metas de ${formatMonthLabel(month).toLocaleLowerCase("pt-BR")}`;

  if (data.scope === "mine") {
    // Membro sem meta e sem venda no mês: nada a mostrar.
    if (!data.target && data.achieved === 0) return null;
    return (
      <Card className="border border-border/50 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>O que você vendeu no mês, pelas propostas aprovadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProgressRow label="Você" achieved={data.achieved} target={data.target} count={data.count} strong />
        </CardContent>
      </Card>
    );
  }

  const hasAnyGoal = Boolean(data.companyTarget) || data.people.some((p) => p.target);
  return (
    <Card className="border border-border/50 shadow-md">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            {isDemo ? "Exemplo da conta de demonstração." : "Valor das propostas aprovadas no mês."}
          </CardDescription>
        </div>
        {isMaster && !isDemo && (
          <Link href="/settings/goals" className="text-sm text-muted-foreground hover:text-foreground">
            {hasAnyGoal ? "Editar metas" : "Definir metas"}
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <ProgressRow
          label="Empresa"
          achieved={data.companyAchieved}
          target={data.companyTarget}
          count={data.companyCount}
          strong
        />
        {data.people.length > 0 && (
          <div className="space-y-4 border-t pt-4">
            {data.people.map((person) => (
              <ProgressRow
                key={person.id}
                label={person.name}
                achieved={person.achieved}
                target={person.target}
              />
            ))}
          </div>
        )}
        {data.unassignedAchieved > 0 && (
          <p className="text-xs text-muted-foreground">
            {money(data.unassignedAchieved)} em propostas sem vendedor, que contam só na meta da empresa.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
