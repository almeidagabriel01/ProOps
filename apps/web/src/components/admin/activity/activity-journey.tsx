"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TenantActivityEvent } from "@/services/admin-service";
import type { TenantActivityType } from "@/lib/activity/catalog";
import { activityDayLabel, activityDayKey, activityTime } from "./activity-format";

/**
 * Do cadastro à assinatura, numa linha: responde "esta empresa clicou em
 * Assinar? abriu o checkout? assinou?" sem ler a linha do tempo inteira.
 */

interface JourneyStep {
  label: string;
  types: TenantActivityType[];
}

export const JOURNEY_STEPS: JourneyStep[] = [
  { label: "Criou a conta", types: ["signup"] },
  { label: "Clicou em Assinar", types: ["subscribe_clicked", "upgrade_prompt_clicked"] },
  { label: "Abriu o checkout", types: ["checkout_started"] },
  { label: "Assinou ou começou o teste", types: ["subscribed", "trial_started"] },
];

/** O PRIMEIRO evento de cada etapa (a lista chega do mais recente para o mais antigo). */
export function resolveJourney(events: TenantActivityEvent[]): Array<{ label: string; at: string | null }> {
  return JOURNEY_STEPS.map((step) => {
    let first: TenantActivityEvent | undefined;
    for (const event of events) {
      if (step.types.includes(event.type)) first = event;
    }
    return { label: step.label, at: first?.createdAt ?? null };
  });
}

interface ActivityJourneyProps {
  events: TenantActivityEvent[];
  isLoading: boolean;
}

export function ActivityJourney({ events, isLoading }: ActivityJourneyProps) {
  const steps = resolveJourney(events);
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Jornada do cadastro à assinatura">
      {steps.map((step) => {
        const done = Boolean(step.at);
        return (
          <li
            key={step.label}
            className={cn(
              "rounded-lg border px-3 py-2",
              done ? "border-emerald-500/30 bg-emerald-500/5" : "border-dashed",
            )}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span>{step.label}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isLoading
                ? "..."
                : step.at
                  ? `${activityDayLabel(activityDayKey(step.at))}, ${activityTime(step.at)}`
                  : "Ainda não"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
