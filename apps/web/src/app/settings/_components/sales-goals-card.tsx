"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { currentMonthKey, formatMonthLabel, shiftMonth } from "@/lib/month-key";
import { SalesGoalsService, type SalesGoalsPerson } from "@/services/sales-goals-service";

interface SalesGoalsCardProps {
  onLoadingChange?: (loading: boolean) => void;
}

type Draft = { company: string; targets: Record<string, string> };

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

/**
 * Metas do mês: a da empresa e a de cada vendedor. Deixar em branco é "sem
 * meta". Dá para ir para meses futuros e planejar antes.
 */
export function SalesGoalsCard({ onLoadingChange }: SalesGoalsCardProps) {
  const [month, setMonth] = React.useState(currentMonthKey);
  const [people, setPeople] = React.useState<SalesGoalsPerson[]>([]);
  const [draft, setDraft] = React.useState<Draft>({ company: "", targets: {} });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    SalesGoalsService.getConfig(month)
      .then((config) => {
        if (cancelled) return;
        setPeople(config.people);
        setDraft(toDraft(config.companyTarget, config.targets));
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

  React.useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  const sumOfPeople = people.reduce((sum, p) => sum + toNumber(draft.targets[p.id]), 0);

  const save = async () => {
    setSaving(true);
    try {
      const targets = Object.fromEntries(
        people.map((p) => [p.id, toNumber(draft.targets[p.id])]).filter(([, v]) => Number(v) > 0),
      ) as Record<string, number>;
      const companyTarget = toNumber(draft.company) || null;
      const saved = await SalesGoalsService.save({ month, companyTarget, targets });
      setDraft(toDraft(saved.companyTarget, saved.targets));
      toast.success(`Metas de ${formatMonthLabel(month).toLocaleLowerCase("pt-BR")} salvas.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar as metas.");
    } finally {
      setSaving(false);
    }
  };

  const money = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Card>
      <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between md:space-y-0">
        <div>
          <CardTitle>Metas do mês</CardTitle>
          <CardDescription>
            Conta o valor das propostas aprovadas no mês, pelo vendedor escolhido em cada uma.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Mês das metas">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
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
            className="h-8 w-8"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="goal-company">Meta da empresa</Label>
              <CurrencyInput
                id="goal-company"
                value={draft.company}
                onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}
                placeholder="Sem meta"
              />
              {sumOfPeople > 0 && (
                <p className="text-xs text-muted-foreground">
                  Soma das metas dos vendedores: {money(sumOfPeople)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Por vendedor</p>
              <ul className="divide-y rounded-lg border">
                {people.map((person) => (
                  <li
                    key={person.id}
                    className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Label htmlFor={`goal-${person.id}`} className="font-normal">
                      {person.name}
                    </Label>
                    <div className="sm:w-48">
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
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader size="sm" variant="button" className="mr-2" />}
                Salvar metas
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
