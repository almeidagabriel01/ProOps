"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { goalPercent } from "@/lib/sales-goals/goal-percent";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { currentMonthKey, formatMonthLabel, shiftMonth } from "@/lib/month-key";
import {
  SalesGoalsService,
  type CompanyGoalProgress,
  type SalesGoalsPerson,
} from "@/services/sales-goals-service";
import { GoalsBodySkeleton } from "./goals-skeleton";

interface SalesGoalsPanelProps {
  /** Título, subtítulo e seletor do grupo. O mês e o salvar ficam à direita dele. */
  header?: React.ReactNode;
}

type Draft = { company: string; targets: Record<string, string> };

/** Pessoa, vendido e meta: o cabeçalho das colunas usa a mesma grade das linhas. */
const TEAM_GRID = "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem]";

function toDraft(companyTarget: number | null, targets: Record<string, number>): Draft {
  return {
    company: companyTarget ? String(companyTarget) : "",
    targets: Object.fromEntries(Object.entries(targets).map(([uid, v]) => [uid, String(v)])),
  };
}

function toNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/**
 * Barra do vendido contra a meta. A meta é a do RASCUNHO, não a gravada: quem
 * digita vê na hora quanto aquele número pede da pessoa.
 */
function ProgressBar({ achieved, target, label }: { achieved: number; target: number; label: string }) {
  const percent = goalPercent(achieved, target) ?? 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={`${label}: ${percent}% da meta`}
      aria-valuenow={Math.min(percent, 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full", percent >= 100 ? "bg-emerald-500" : "bg-primary")}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function Percent({ achieved, target }: { achieved: number; target: number }) {
  const percent = goalPercent(achieved, target);
  if (percent === null) return null;
  return (
    <span className={cn("font-medium", percent >= 100 ? "text-emerald-600" : "text-foreground")}>
      {percent}%
    </span>
  );
}

/**
 * Metas do mês: a da empresa e a de cada pessoa da equipe, com o que cada uma
 * já vendeu ao lado. Deixar em branco é "sem meta". Dá para ir para meses
 * futuros e planejar antes.
 */
export function SalesGoalsPanel({ header }: SalesGoalsPanelProps) {
  const [month, setMonth] = React.useState(currentMonthKey);
  const [people, setPeople] = React.useState<SalesGoalsPerson[]>([]);
  const [draft, setDraft] = React.useState<Draft>({ company: "", targets: {} });
  const [progress, setProgress] = React.useState<CompanyGoalProgress | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // O vendido é complemento: sem ele a tela continua servindo para definir
    // as metas, então a falha dele não derruba o formulário.
    const progressRequest = SalesGoalsService.progress(month).catch((error) => {
      console.warn("[metas] não foi possível carregar o vendido do mês:", error);
      return null;
    });
    Promise.all([SalesGoalsService.getConfig(month), progressRequest])
      .then(([config, monthProgress]) => {
        if (cancelled) return;
        setPeople(config.people);
        setDraft(toDraft(config.companyTarget, config.targets));
        setProgress(monthProgress?.scope === "company" ? monthProgress : null);
      })
      .catch(() => {
        if (!cancelled) toast.error("Erro ao carregar as metas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const achievedBy = React.useMemo(
    () => new Map((progress?.people ?? []).map((person) => [person.id, person.achieved])),
    [progress],
  );
  const sumOfPeople = people.reduce((sum, p) => sum + toNumber(draft.targets[p.id]), 0);
  const companyTarget = toNumber(draft.company);
  const companyAchieved = progress?.companyAchieved ?? 0;
  const gap = companyTarget - sumOfPeople;

  const save = async () => {
    setSaving(true);
    try {
      const targets = Object.fromEntries(
        people.map((p) => [p.id, toNumber(draft.targets[p.id])]).filter(([, v]) => Number(v) > 0),
      ) as Record<string, number>;
      const saved = await SalesGoalsService.save({ month, companyTarget: companyTarget || null, targets });
      setDraft(toDraft(saved.companyTarget, saved.targets));
      toast.success(`Metas de ${formatMonthLabel(month).toLocaleLowerCase("pt-BR")} salvas.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar as metas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {header}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1" role="group" aria-label="Mês das metas">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">
              {formatMonthLabel(month)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => void save()} disabled={saving || loading}>
            {saving && <Loader size="sm" variant="button" className="mr-2" />}
            Salvar metas
          </Button>
        </div>
      </div>

      {loading ? (
        <GoalsBodySkeleton />
      ) : (
        // Sem items-start: os dois cards esticam até a altura do mais alto.
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Empresa</CardTitle>
              <CardDescription>O valor das propostas aprovadas no mês.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="goal-company">Meta da empresa</Label>
                <CurrencyInput
                  id="goal-company"
                  value={draft.company}
                  onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
                  placeholder="Sem meta"
                />
              </div>

              {progress && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Vendido no mês</p>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-2xl font-semibold tabular-nums">{money(companyAchieved)}</span>
                    {companyTarget > 0 && <Percent achieved={companyAchieved} target={companyTarget} />}
                  </div>
                  {companyTarget > 0 && (
                    <ProgressBar achieved={companyAchieved} target={companyTarget} label="Empresa" />
                  )}
                  {progress.companyCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {progress.companyCount === 1
                        ? "1 proposta aprovada"
                        : `${progress.companyCount} propostas aprovadas`}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2 border-t pt-4 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Soma das metas da equipe</span>
                  <span className="font-medium tabular-nums">{sumOfPeople > 0 ? money(sumOfPeople) : "—"}</span>
                </div>
                {companyTarget > 0 && sumOfPeople > 0 && gap !== 0 && (
                  <p className="text-xs text-muted-foreground">
                    {gap > 0
                      ? `${money(gap)} da meta da empresa ainda não estão com ninguém da equipe.`
                      : `A equipe soma ${money(-gap)} acima da meta da empresa.`}
                  </p>
                )}
                {progress && progress.unassignedAchieved > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {money(progress.unassignedAchieved)} em propostas sem responsável pela venda, que contam só na
                    meta da empresa.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Equipe</CardTitle>
              <CardDescription>
                A venda conta para o responsável escolhido em cada proposta. Em branco é sem meta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {people.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Ninguém na equipe ainda. Convide as pessoas em Configurações › Equipe.
                </p>
              ) : (
                <>
                  <div
                    className={cn("hidden gap-4 px-3 pb-2 text-xs font-medium text-muted-foreground sm:grid", TEAM_GRID)}
                    aria-hidden="true"
                  >
                    <span>Pessoa</span>
                    <span>Vendido no mês</span>
                    <span>Meta</span>
                  </div>
                  <ul className="divide-y rounded-lg border">
                    {people.map((person) => {
                      const achieved = achievedBy.get(person.id) ?? 0;
                      const target = toNumber(draft.targets[person.id]);
                      return (
                        <li key={person.id} className={cn("grid gap-3 p-3 sm:items-center sm:gap-4", TEAM_GRID)}>
                          <Label htmlFor={`goal-${person.id}`} className="truncate font-medium">
                            {person.name}
                          </Label>
                          <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                              <span className="tabular-nums text-muted-foreground">
                                {progress ? money(achieved) : "—"}
                              </span>
                              {progress && target > 0 && <Percent achieved={achieved} target={target} />}
                            </div>
                            {progress && target > 0 && (
                              <ProgressBar achieved={achieved} target={target} label={person.name} />
                            )}
                          </div>
                          <CurrencyInput
                            id={`goal-${person.id}`}
                            value={draft.targets[person.id] ?? ""}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                targets: { ...d.targets, [person.id]: e.target.value },
                              }))
                            }
                            placeholder="Sem meta"
                          />
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
