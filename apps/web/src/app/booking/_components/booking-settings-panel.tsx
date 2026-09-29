"use client";

import * as React from "react";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { WEEKDAY_OPTIONS, formatDuration, formatMinutes } from "@/lib/booking/booking-format";
import { BookingService, type BookingSettings } from "@/services/booking-service";
import { BookingBodySkeleton } from "./booking-skeleton";
import { BookingExceptionsEditor } from "./booking-exceptions-editor";

interface BookingSettingsPanelProps {
  /** Título, subtítulo e seletor do grupo. O interruptor e o salvar ficam à direita dele. */
  header?: React.ReactNode;
  /** Conta de demonstração: mostra o padrão, sem link e sem salvar. */
  readOnly?: boolean;
  /** Tipo de visita padrão do nicho, para a demonstração. */
  demoDefaults?: BookingSettings;
}

const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => i * 30);
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const LEAD_OPTIONS = [
  { value: 0, label: "Sem antecedência mínima" },
  { value: 2, label: "2 horas antes" },
  { value: 4, label: "4 horas antes" },
  { value: 12, label: "12 horas antes" },
  { value: 24, label: "1 dia antes" },
  { value: 48, label: "2 dias antes" },
];
const HORIZON_OPTIONS = [7, 14, 21, 30, 60];

/**
 * Nome, duração e lixeira. O cabeçalho usa a mesma grade, senão o rótulo da
 * duração não fica em cima da coluna dela. A coluna da lixeira existe sempre,
 * mesmo vazia, para a largura não mudar ao remover o penúltimo tipo.
 */
const visitTypeGrid = "sm:grid sm:grid-cols-[minmax(0,1fr)_9rem_2.5rem]";

/**
 * Link de agendamento: o link, o expediente (dias, horário, antecedência, até
 * quando), os tipos de visita e as exceções, cada um no seu card. O cliente só
 * vê o que está livre nesse expediente, descontando o Calendário.
 */
export function BookingSettingsPanel({ header, readOnly = false, demoDefaults }: BookingSettingsPanelProps) {
  const [settings, setSettings] = React.useState<BookingSettings | null>(readOnly ? demoDefaults ?? null : null);
  const [loading, setLoading] = React.useState(!readOnly);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    BookingService.getSettings()
      .then((value) => {
        if (!cancelled) setSettings(value);
      })
      .catch(() => {
        if (!cancelled) toast.error("Erro ao carregar o link de agendamento.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  const update = (patch: Partial<BookingSettings>) => setSettings((current) => (current ? { ...current, ...patch } : current));
  const link =
    settings?.publicToken && typeof window !== "undefined"
      ? `${window.location.origin}/share/visita/${settings.publicToken}`
      : null;

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await BookingService.saveSettings(settings);
      setSettings(saved);
      toast.success(saved.enabled ? "Link de agendamento salvo e ligado." : "Configuração salva. O link está desligado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie à mão.");
    }
  };

  const headerRow = (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      {header}
      {settings && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 items-center gap-3 rounded-lg border px-3">
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => update({ enabled })}
              disabled={readOnly}
              aria-label="Ligar o link de agendamento"
            />
            <span className="text-sm font-medium">{settings.enabled ? "Link ligado" : "Link desligado"}</span>
          </div>
          {!readOnly && (
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader size="sm" variant="button" className="mr-2" />}
              Salvar
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {headerRow}
        <BookingBodySkeleton />
      </div>
    );
  }
  if (!settings) return <div className="space-y-6">{headerRow}</div>;

  return (
    <div className="space-y-6">
      {headerRow}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Link para o cliente</CardTitle>
              <CardDescription>
                Mande ao cliente ou ponha no seu site. O pedido entra no Calendário como &quot;a confirmar&quot;, e
                você confirma ou recusa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {readOnly ? (
                <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Na conta de demonstração o link fica desligado. Este é o expediente com que ele nasce.
                </p>
              ) : settings.enabled && link ? (
                <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 break-all text-sm">{link}</code>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => void copyLink()}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={link} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  {settings.enabled
                    ? "O link aparece aqui depois de salvar."
                    : "O link está desligado. Ligue no alto da página e salve para o cliente poder agendar."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expediente</CardTitle>
              <CardDescription>
                Quando a equipe atende. O cliente só vê os horários livres, descontando o Calendário.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Dias de atendimento</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Dias de atendimento">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const active = settings.days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        disabled={readOnly}
                        aria-pressed={active}
                        onClick={() =>
                          update({
                            days: active
                              ? settings.days.filter((d) => d !== day.value)
                              : [...settings.days, day.value],
                          })
                        }
                        className={cn(
                          "h-9 min-w-12 rounded-full border px-3 text-sm transition disabled:cursor-default",
                          active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="booking-start">Início do expediente</Label>
                  <Select
                    id="booking-start"
                    value={String(settings.startMin)}
                    onChange={(e) => update({ startMin: Number(e.target.value) })}
                    disabled={readOnly}
                    disableSort
                  >
                    {TIME_OPTIONS.slice(0, -1).map((m) => (
                      <option key={m} value={m}>
                        {formatMinutes(m)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-end">Fim do expediente</Label>
                  <Select
                    id="booking-end"
                    value={String(settings.endMin)}
                    onChange={(e) => update({ endMin: Number(e.target.value) })}
                    disabled={readOnly}
                    disableSort
                  >
                    {TIME_OPTIONS.slice(1).map((m) => (
                      <option key={m} value={m}>
                        {formatMinutes(m)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-lead">Antecedência</Label>
                  <Select
                    id="booking-lead"
                    value={String(settings.leadHours)}
                    onChange={(e) => update({ leadHours: Number(e.target.value) })}
                    disabled={readOnly}
                    disableSort
                  >
                    {LEAD_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="booking-horizon">Mostrar horários para os próximos</Label>
                  <Select
                    id="booking-horizon"
                    value={String(settings.horizonDays)}
                    onChange={(e) => update({ horizonDays: Number(e.target.value) })}
                    disabled={readOnly}
                    disableSort
                  >
                    {HORIZON_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} dias
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tipos de visita</CardTitle>
              <CardDescription>O que o cliente pode pedir e quanto tempo cada visita ocupa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Os dois rótulos em cima das colunas; no celular cada linha
                  empilha, e a duração ganha o rótulo dela. */}
              <div className={cn("hidden gap-2", visitTypeGrid)}>
                <Label>Nome</Label>
                <Label className="whitespace-nowrap">Tempo de duração</Label>
              </div>
              <ul className="space-y-2">
                {settings.visitTypes.map((type, index) => (
                  <li key={type.id || index} className={cn("flex flex-col gap-2 sm:items-center", visitTypeGrid)}>
                    <Input
                      aria-label={`Nome do tipo de visita ${index + 1}`}
                      value={type.label}
                      maxLength={60}
                      disabled={readOnly}
                      onChange={(e) =>
                        update({
                          visitTypes: settings.visitTypes.map((t, i) => (i === index ? { ...t, label: e.target.value } : t)),
                        })
                      }
                    />
                    <div className="flex items-center gap-2 sm:contents">
                      <span className="shrink-0 text-sm text-muted-foreground sm:hidden">Tempo de duração</span>
                      <Select
                        aria-label={`Tempo de duração do tipo de visita ${index + 1}`}
                        value={String(type.durationMin)}
                        disabled={readOnly}
                        onChange={(e) =>
                          update({
                            visitTypes: settings.visitTypes.map((t, i) =>
                              i === index ? { ...t, durationMin: Number(e.target.value) } : t,
                            ),
                          })
                        }
                        disableSort
                      >
                        {DURATIONS.map((d) => (
                          <option key={d} value={d}>
                            {formatDuration(d)}
                          </option>
                        ))}
                      </Select>
                      {!readOnly && settings.visitTypes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover ${type.label || "tipo de visita"}`}
                          onClick={() => update({ visitTypes: settings.visitTypes.filter((_, i) => i !== index) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {!readOnly && settings.visitTypes.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => update({ visitTypes: [...settings.visitTypes, { id: "", label: "", durationMin: 60 }] })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar tipo de visita
                </Button>
              )}
            </CardContent>
          </Card>

          {settings.exceptions && (
            <Card>
              <CardHeader>
                <CardTitle>Exceções</CardTitle>
                <CardDescription>
                  Dias ou horários em que você não vai atender. O link não oferece esses horários.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BookingExceptionsEditor
                  exceptions={settings.exceptions}
                  onChange={(exceptions) => update({ exceptions })}
                  readOnly={readOnly}
                  startMin={settings.startMin}
                  endMin={settings.endMin}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
