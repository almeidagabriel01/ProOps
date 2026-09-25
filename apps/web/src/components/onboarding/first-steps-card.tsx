"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Rocket, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/providers/permissions-provider";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { countTenantDocs, countTenantMembers } from "@/lib/plan-usage-counts";
import { cn } from "@/lib/utils";
import { buildFirstStepsTasks, type FirstStepsCounts } from "./first-steps";
import { useOptionalOnboarding } from "./onboarding-provider";

async function loadCounts(tenantId: string, withMembers: boolean): Promise<FirstStepsCounts> {
  // Aggregation count(): uma leitura por coleção, independente do tamanho.
  // Contagem que falha vira 0: o pior caso é a tarefa aparecer pendente.
  const safe = (promise: Promise<number>) => promise.catch(() => 0);
  const [products, services, clients, proposals, members] = await Promise.all([
    safe(countTenantDocs("products", tenantId)),
    safe(countTenantDocs("services", tenantId)),
    safe(countTenantDocs("clients", tenantId)),
    safe(countTenantDocs("proposals", tenantId)),
    withMembers ? safe(countTenantMembers(tenantId)) : Promise.resolve(0),
  ]);
  return { products, services, clients, proposals, members };
}

export function FirstStepsCard() {
  const onboarding = useOptionalOnboarding();
  const { user } = useAuth();
  const { tenant, isDemo } = useTenant();
  const { isMaster, hasPermission, isLoading: isPermLoading } = usePermissions();
  const { features } = usePlanLimits();
  const [counts, setCounts] = React.useState<FirstStepsCounts | null>(null);

  // Só conta nova (que nasceu com o estado do tutorial), fora da demonstração
  // e fora do "Acessar Painel" do super admin.
  const eligible =
    !!onboarding &&
    !!user?.onboarding &&
    !onboarding.firstStepsDismissed &&
    !isDemo &&
    String(user?.role || "").toLowerCase() !== "superadmin" &&
    !!tenant?.id &&
    !isPermLoading;

  React.useEffect(() => {
    if (!eligible || !tenant?.id) return;
    let cancelled = false;
    void loadCounts(tenant.id, isMaster).then((result) => {
      if (!cancelled) setCounts(result);
    });
    return () => {
      cancelled = true;
    };
  }, [eligible, tenant?.id, isMaster]);

  const tasks = React.useMemo(
    () =>
      counts
        ? buildFirstStepsTasks(counts, {
            isMaster,
            hasPermission,
            maxUsers: features?.maxUsers ?? 1,
            hasLogo: !!tenant?.logoUrl,
          })
        : [],
    [counts, isMaster, hasPermission, features?.maxUsers, tenant?.logoUrl],
  );

  const doneCount = tasks.filter((task) => task.done).length;
  if (!eligible || !counts || tasks.length === 0 || doneCount === tasks.length) {
    return null;
  }

  const nextTask = tasks.find((task) => !task.done);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background" data-testid="first-steps-card">
      <CardContent className="space-y-4 p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Rocket className="h-5 w-5" aria-hidden />
            </span>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Primeiros passos</h2>
              <p className="text-sm text-muted-foreground">
                Deixe a ProOps pronta para enviar a sua primeira proposta.{" "}
                <span className="tabular-nums">
                  {doneCount} de {tasks.length} feitos.
                </span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-2 h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => void onboarding?.dismissFirstSteps()}
            aria-label="Dispensar primeiros passos"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Primeiros passos concluídos"
          aria-valuemin={0}
          aria-valuemax={tasks.length}
          aria-valuenow={doneCount}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${Math.round((doneCount / tasks.length) * 100)}%` }}
          />
        </div>

        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={task.href}
                className={cn(
                  "group flex h-full items-start gap-3 rounded-lg border p-3 transition-colors",
                  task.done
                    ? "border-border/50 bg-muted/30"
                    : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
                  task.id === nextTask?.id && "ring-1 ring-primary/30",
                )}
                data-testid={`first-steps-task-${task.id}`}
                data-done={task.done || undefined}
              >
                {task.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      task.done && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                    {task.done && <span className="sr-only"> (feito)</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">{task.description}</span>
                </span>
                {!task.done && (
                  <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
