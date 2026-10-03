"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Circle, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader } from "@/components/ui/loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/field-service/contracts";
import { STATUS_LABELS } from "@/lib/field-service/service-orders";
import { PMOC_PERIOD_LABELS, pmocPeriod, type PmocPeriodPreset } from "@/lib/field-service/pmoc-period";
import { todayInBrazil } from "@/lib/field-service/technical-responsibles";
import { PmocService, type PmocDocumentKind, type PmocView } from "@/services/pmoc-service";
import type { ServiceOrderStatus } from "@/types/field-service";

/**
 * O PMOC do prédio, aberto pelo link do contrato: o plano (quem assina, o
 * prédio, os aparelhos e os itens com a frequência) e o relatório de execução
 * de um período. É a página que fica à mão para a fiscalização, e a que o
 * backend imprime no PDF (`?print=1&kind=plan|report`, marcador
 * `data-pdf-pmoc-ready`).
 */
export default function SharedPmocPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = String(params.token || "");
  const isPrint = searchParams.get("print") === "1";
  const printKind: PmocDocumentKind = searchParams.get("kind") === "report" ? "report" : "plan";
  const printFrom = searchParams.get("from");
  const printTo = searchParams.get("to");

  const [kind, setKind] = React.useState<PmocDocumentKind>(printKind);
  const [preset, setPreset] = React.useState<PmocPeriodPreset>("last12");
  const period = React.useMemo(
    () => (isPrint && printFrom && printTo ? { from: printFrom, to: printTo } : pmocPeriod(preset, todayInBrazil())),
    [isPrint, printFrom, printTo, preset],
  );

  const [view, setView] = React.useState<PmocView | null>(null);
  const [error, setError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    PmocService.view(token, period)
      .then((res) => {
        if (cancelled) return;
        setView(res);
        setError(false);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, period]);

  if (loading && !view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Link indisponível</AlertTitle>
              <AlertDescription>Link inválido ou PMOC não encontrado.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accent = view.tenant.primaryColor || undefined;
  const shown: PmocDocumentKind = isPrint ? printKind : kind;

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <header className="border-b bg-card print:border-b-2" style={accent ? { borderColor: accent } : undefined}>
        <div className="container mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {view.tenant.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- logo da empresa, também impresso no PDF
              <img
                src={view.tenant.logoUrl}
                alt={view.tenant.name ?? "Logo"}
                className="h-10 w-auto shrink-0 rounded-md object-contain"
              />
            )}
            <div className="min-w-0">
              <p className="truncate font-bold">{view.tenant.name || "PMOC"}</p>
              <p className="truncate text-sm text-muted-foreground">
                Plano de Manutenção, Operação e Controle · {view.contract.code}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section>
          <p className="text-sm text-muted-foreground">
            {shown === "report" ? "Relatório de execução" : "PMOC"}, conforme a Lei 13.589/2018
          </p>
          <h1 className="break-words text-2xl font-bold">{view.building.name || view.client.name}</h1>
          {view.building.address && <p className="mt-1 text-muted-foreground">{view.building.address}</p>}
        </section>

        {!isPrint && (
          <SegmentedControl
            id="pmoc-document"
            value={kind}
            onChange={(v) => setKind(v as PmocDocumentKind)}
            options={[
              { value: "plan", label: "Plano" },
              { value: "report", label: "Relatório de execução" },
            ]}
          />
        )}

        <section className="grid gap-4 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
          <Info label="Cliente" value={view.client.name} />
          <Info label="Uso do ambiente" value={view.building.use} />
          <Info label="Ocupantes" value={view.building.occupants != null ? String(view.building.occupants) : null} />
          <Info
            label="Área climatizada"
            value={
              view.building.climatizedArea != null
                ? `${view.building.climatizedArea.toLocaleString("pt-BR")} m²`
                : null
            }
          />
          <Info
            label="Visitas"
            value={
              view.contract.intervalMonths
                ? view.contract.intervalMonths === 1
                  ? "Todo mês"
                  : `A cada ${view.contract.intervalMonths} meses`
                : null
            }
          />
          <Info label="Vigência" value={view.contract.startDate ? `Desde ${formatDay(view.contract.startDate)}` : null} />
        </section>

        <section className="space-y-2 print:break-inside-avoid">
          <h2 className="font-semibold">Responsável técnico</h2>
          {view.responsible ? (
            <div className="grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
              <Info label="Nome" value={view.responsible.name} />
              <Info label="Profissão" value={view.responsible.profession} />
              <Info
                label="Registro"
                value={[view.responsible.council, view.responsible.registryNumber].filter(Boolean).join(" ") || null}
              />
              <Info
                label="ART"
                value={
                  [
                    view.responsible.artNumber,
                    view.responsible.artValidUntil ? `válida até ${formatDay(view.responsible.artValidUntil)}` : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || null
                }
              />
              {view.responsible.artUrl && !isPrint && (
                <a
                  href={view.responsible.artUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary underline-offset-4 hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  Ver a ART
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Responsável técnico ainda não definido.</p>
          )}
        </section>

        {shown === "plan" ? <PlanSection view={view} /> : (
          <ReportSection view={view} isPrint={isPrint} preset={preset} onPreset={setPreset} loading={loading} />
        )}
      </main>
      {!loading && <span data-pdf-pmoc-ready="1" style={{ display: "none" }} />}
    </div>
  );
}

function PlanSection({ view }: { view: PmocView }) {
  return (
    <>
      {view.equipment.length > 0 && (
        <section className="space-y-2 print:break-inside-avoid">
          <h2 className="font-semibold">Equipamentos cobertos</h2>
          <div className="overflow-hidden rounded-lg border text-sm">
            {view.equipment.map((e, i) => (
              <div key={`${e.name}-${i}`} className="border-b px-3 py-2 last:border-b-0">
                <p className="font-medium">{e.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[e.type, [e.brand, e.model].filter(Boolean).join(" "), e.capacity, e.location]
                    .filter(Boolean)
                    .join(" · ") || "Sem detalhes"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Itens do plano</h2>
        {view.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum item no plano.</p>
        ) : (
          view.groups.map((group) => (
            <div key={group.label} className="overflow-hidden rounded-lg border text-sm print:break-inside-avoid">
              <p className="bg-muted/50 px-3 py-2 font-medium">{group.label}</p>
              {group.items.map((item, i) => (
                <div key={`${item.text}-${i}`} className="flex items-start justify-between gap-3 border-t px-3 py-2">
                  <span className="min-w-0">{item.text}</span>
                  <span className="shrink-0 text-muted-foreground">{item.frequency}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </section>
    </>
  );
}

interface ReportSectionProps {
  view: PmocView;
  isPrint: boolean;
  preset: PmocPeriodPreset;
  onPreset: (preset: PmocPeriodPreset) => void;
  loading: boolean;
}

function ReportSection({ view, isPrint, preset, onPreset, loading }: ReportSectionProps) {
  return (
    <>
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          De {formatDay(view.period.from)} a {formatDay(view.period.to)}
        </p>
        {!isPrint && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PMOC_PERIOD_LABELS) as PmocPeriodPreset[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onPreset(key)}
                disabled={loading}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  key === preset ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground",
                )}
              >
                {PMOC_PERIOD_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Execução por item</h2>
        <div className="overflow-hidden rounded-lg border text-sm">
          {view.executions.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 border-b px-3 py-2 last:border-b-0">
              <span className="min-w-0">
                {item.category}: {item.text}
                <span className="block text-xs text-muted-foreground">{item.frequency}</span>
              </span>
              <span className={cn("shrink-0 text-right", item.timesDone === 0 && "text-amber-600 dark:text-amber-400")}>
                {item.timesDone === 0 ? "Não feito" : `${item.timesDone}x`}
                {item.lastDoneOn && (
                  <span className="block text-xs text-muted-foreground">última {formatDay(item.lastDoneOn)}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Visitas</h2>
        {view.visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma visita no período.</p>
        ) : (
          view.visits.map((visit) => (
            <div key={visit.code} className="space-y-2 rounded-lg border p-3 text-sm print:break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {visit.code} · {visit.day ? formatDay(visit.day) : "Sem data"}
                </p>
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABELS[visit.status as ServiceOrderStatus] ?? visit.status}
                  {visit.technicianName ? ` · ${visit.technicianName}` : ""}
                </span>
              </div>
              {visit.checklist.length > 0 && (
                <ul className="space-y-0.5">
                  {visit.checklist.map((c, i) => (
                    <li key={`${c.text}-${i}`} className={cn("flex items-center gap-2", !c.done && "text-muted-foreground")}>
                      {c.done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0" />
                      )}
                      {c.text}
                    </li>
                  ))}
                </ul>
              )}
              {visit.report && <p className="whitespace-pre-line text-muted-foreground">{visit.report}</p>}
              {visit.signedBy && <p className="text-xs text-muted-foreground">Assinada por {visit.signedBy}.</p>}
            </div>
          ))
        )}
      </section>
    </>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
