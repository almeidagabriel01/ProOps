"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Loader } from "@/components/ui/loader";
import { Textarea } from "@/components/ui/textarea";
import { useThemeAdjustedColor } from "@/hooks/useThemeAdjustedColor";
import { getCaptchaToken, isCaptchaConfigured, mountCaptcha } from "@/lib/captcha";
import { cn } from "@/lib/utils";
import { brandButtonStyle, computePrimaryForeground, normalizeHex } from "@/utils/color-utils";
import { describeBookingWhen, formatDuration, todayInBrazil } from "@/lib/booking/booking-format";
import { BookingService, type PublicBookingView, type VisitType } from "@/services/booking-service";
import { BookingCalendar } from "./booking-calendar";
import { BookingTimeSlots } from "./booking-time-slots";

interface PublicBookingProps {
  token: string;
}

interface Chosen {
  date: string;
  startMin: number;
}

interface ContactForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  website: string;
}

type Step = "slot" | "form";

const EMPTY_FORM: ContactForm = { name: "", phone: "", email: "", address: "", notes: "", website: "" };

function errorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * A cor da empresa em variáveis CSS. `--brand` pinta o que é preenchido (o dia
 * escolhido, o horário escolhido), com `--brand-fg` por cima. `--brand-line` é
 * a mesma cor ajustada ao tema, para borda, anel e os tons claros feitos com
 * `color-mix`: uma empresa de cor branca some no cartão claro, e uma preta no
 * escuro. Sem cor, vale a do tema.
 */
function brandVariables(color: string | null | undefined, themeAdjusted: string): React.CSSProperties {
  const hex = normalizeHex(color);
  return {
    "--brand": hex ?? "var(--primary)",
    "--brand-fg": hex ? computePrimaryForeground(hex) : "var(--primary-foreground)",
    "--brand-line": hex ? themeAdjusted : "var(--primary)",
  } as React.CSSProperties;
}

/**
 * O cliente escolhe o tipo de visita, o dia e o horário, e deixa o contato. O
 * pedido não é uma visita marcada: a empresa confirma, e só então o horário
 * vale. A tela diz isso antes e depois de enviar.
 */
export function PublicBooking({ token }: PublicBookingProps) {
  const [view, setView] = React.useState<PublicBookingView | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [visitTypeId, setVisitTypeId] = React.useState<string | null>(null);
  const [date, setDate] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState<Chosen | null>(null);
  const [step, setStep] = React.useState<Step>("slot");
  const [form, setForm] = React.useState<ContactForm>(EMPTY_FORM);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState<{ label: string; when: string } | null>(null);
  const brandLine = useThemeAdjustedColor(view?.company.primaryColor);

  const load = React.useCallback(async () => {
    try {
      const next = await BookingService.publicView(token);
      setView(next);
      setVisitTypeId((current) =>
        current && next.visitTypes.some((t) => t.id === current) ? current : next.visitTypes[0]?.id ?? null,
      );
      setLoadError(null);
    } catch {
      setLoadError("Este link de agendamento não está disponível. Fale com a empresa.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const captchaRef = React.useCallback((el: HTMLDivElement | null) => mountCaptcha(el), []);

  const days = React.useMemo(
    () => (view && visitTypeId ? (view.slots[visitTypeId] ?? []).filter((d) => d.starts.length > 0) : []),
    [view, visitTypeId],
  );
  const availableDates = React.useMemo(() => new Set(days.map((d) => d.date)), [days]);
  const activeDate = date && availableDates.has(date) ? date : days[0]?.date ?? null;
  const starts = days.find((d) => d.date === activeDate)?.starts ?? [];
  const visitType = view?.visitTypes.find((t) => t.id === visitTypeId) ?? null;
  const minMonth = days[0]?.date.slice(0, 7) ?? null;
  const maxMonth = days.at(-1)?.date.slice(0, 7) ?? null;
  const shownMonth =
    month && minMonth && maxMonth && month >= minMonth && month <= maxMonth ? month : activeDate?.slice(0, 7) ?? null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader size="lg" />
      </div>
    );
  }

  if (loadError || !view) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Link indisponível</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const chooseVisitType = (id: string) => {
    setVisitTypeId(id);
    setDate(null);
    setMonth(null);
    setChosen(null);
    setStep("slot");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chosen || !visitType) return;
    if (form.name.trim().length < 2 || form.phone.replace(/\D/g, "").length < 10) {
      setSubmitError("Informe o seu nome e um telefone com DDD.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const captchaToken = await getCaptchaToken({ interactive: true });
      if (isCaptchaConfigured() && !captchaToken) {
        setSubmitError("Não foi possível confirmar que você não é um robô. Tente de novo.");
        return;
      }
      await BookingService.submit(token, {
        visitTypeId: visitType.id,
        date: chosen.date,
        startMin: chosen.startMin,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        website: form.website || undefined,
        captchaToken: captchaToken || undefined,
      });
      setSent({ label: visitType.label, when: describeBookingWhen(chosen.date, chosen.startMin) });
    } catch (error) {
      if (errorStatus(error) === 409) {
        setSubmitError("Esse horário acabou de ser ocupado. Escolha outro.");
        setChosen(null);
        setStep("slot");
        void load();
      } else {
        setSubmitError(error instanceof Error && error.message ? error.message : "Não foi possível enviar. Tente de novo.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const companyName = view.company.name;

  return (
    <div className="min-h-screen bg-muted/40" style={brandVariables(view.company.primaryColor, brandLine)}>
      {/* Faixa com a cor da empresa atrás do cartão. */}
      <div
        aria-hidden="true"
        className="h-44 bg-[linear-gradient(135deg,var(--brand),color-mix(in_oklab,var(--brand)_70%,black))] md:h-60"
      />

      <main className="relative mx-auto -mt-36 max-w-5xl px-4 pb-10 md:-mt-48 md:pb-16">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xl lg:grid lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6 border-b bg-muted/30 p-5 md:p-8 lg:border-b-0 lg:border-r">
            <CompanyHeader name={companyName} logoUrl={view.company.logoUrl} />

            <VisitTypePicker
              visitTypes={view.visitTypes}
              selectedId={visitTypeId}
              disabled={Boolean(sent)}
              onSelect={chooseVisitType}
            />

            {chosen && visitType && (
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sua escolha</p>
                <p className="flex items-start gap-2 text-sm font-medium">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="first-letter:uppercase">{describeBookingWhen(chosen.date, chosen.startMin)}</span>
                </p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  {visitType.label}, {formatDuration(visitType.durationMin)}
                </p>
              </div>
            )}

            <HowItWorks companyName={companyName} />
          </aside>

          <section className="relative p-5 md:p-8">
            {sent ? (
              <SentState
                companyName={companyName}
                label={sent.label}
                when={sent.when}
                byEmail={Boolean(form.email.trim())}
              />
            ) : (
              <>
                <StepIndicator step={step} />

                {step === "slot" && (
                  <div className="mt-6">
                    {days.length === 0 || !activeDate || !shownMonth || !minMonth || !maxMonth ? (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
                        <CalendarClock className="h-10 w-10 text-muted-foreground" />
                        <p className="max-w-sm text-sm text-muted-foreground">
                          Não há horário livre nos próximos dias. Fale com a {companyName} para combinar.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_240px]">
                        <BookingCalendar
                          availableDates={availableDates}
                          selected={activeDate}
                          month={shownMonth}
                          minMonth={minMonth}
                          maxMonth={maxMonth}
                          today={todayInBrazil()}
                          onMonthChange={setMonth}
                          onSelect={(next) => {
                            setDate(next);
                            setChosen(null);
                            setSubmitError(null);
                          }}
                        />
                        <div className="md:max-h-[420px] md:overflow-y-auto md:pr-1">
                          <BookingTimeSlots
                            date={activeDate}
                            starts={starts}
                            selected={chosen?.date === activeDate ? chosen.startMin : null}
                            onSelect={(startMin) => {
                              setChosen({ date: activeDate, startMin });
                              setSubmitError(null);
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {submitError && (
                      <p role="alert" className="mt-4 text-sm text-destructive">
                        {submitError}
                      </p>
                    )}

                    {chosen && (
                      <div className="sticky bottom-0 -mx-5 mt-6 flex items-center justify-between gap-3 border-t bg-card/95 px-5 py-4 backdrop-blur md:static md:mx-0 md:rounded-xl md:border md:bg-muted/30 md:px-4">
                        <p className="min-w-0 text-sm">
                          <span className="block text-muted-foreground">Horário escolhido</span>
                          <span className="block truncate font-medium first-letter:uppercase">
                            {describeBookingWhen(chosen.date, chosen.startMin)}
                          </span>
                        </p>
                        <Button
                          type="button"
                          className="shrink-0"
                          style={brandButtonStyle(view.company.primaryColor)}
                          onClick={() => {
                            setSubmitError(null);
                            setStep("form");
                          }}
                        >
                          Continuar
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {step === "form" && chosen && visitType && (
                  <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[color-mix(in_oklab,var(--brand-line)_10%,transparent)] p-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold first-letter:uppercase">
                          {describeBookingWhen(chosen.date, chosen.startMin)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {visitType.label}, {formatDuration(visitType.durationMin)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="bg-card"
                        onClick={() => {
                          setSubmitError(null);
                          setStep("slot");
                        }}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Trocar horário
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="booking-name">Nome</Label>
                        <Input
                          id="booking-name"
                          autoComplete="name"
                          maxLength={120}
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="booking-phone">Telefone (WhatsApp)</Label>
                        <PhoneInput
                          id="booking-phone"
                          inputMode="tel"
                          autoComplete="tel"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="booking-email">E-mail (opcional)</Label>
                        <Input
                          id="booking-email"
                          type="email"
                          autoComplete="email"
                          maxLength={160}
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="booking-address">Endereço da visita</Label>
                        <Input
                          id="booking-address"
                          autoComplete="street-address"
                          maxLength={240}
                          value={form.address}
                          onChange={(e) => setForm({ ...form, address: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-notes">Observações (opcional)</Label>
                      <Textarea
                        id="booking-notes"
                        rows={3}
                        maxLength={1000}
                        placeholder="Algo que a equipe precisa saber antes de ir?"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </div>
                    {/* Isca para robô: gente não vê nem preenche. */}
                    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                      <label htmlFor="booking-website">Site</label>
                      <input
                        id="booking-website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.website}
                        onChange={(e) => setForm({ ...form, website: e.target.value })}
                      />
                    </div>
                    <div ref={captchaRef} />
                    {submitError && (
                      <p role="alert" className="text-sm text-destructive">
                        {submitError}
                      </p>
                    )}
                    <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        O horário fica reservado e a {companyName} confirma com você.
                      </p>
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full sm:w-auto"
                        disabled={submitting}
                        style={brandButtonStyle(view.company.primaryColor)}
                      >
                        {submitting && <Loader size="sm" variant="button" className="mr-2" />}
                        Pedir a visita
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">Horários no fuso de Brasília.</p>
      </main>
    </div>
  );
}

function CompanyHeader({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <header className="flex items-center gap-3">
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={name}
          width={56}
          height={56}
          unoptimized
          className="h-14 w-14 rounded-xl border bg-card object-contain p-1"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] ring-1 ring-[var(--brand-line)]">
          <CalendarClock className="h-7 w-7" />
        </div>
      )}
      <div className="min-w-0">
        <h1 className="line-clamp-2 break-words text-lg font-semibold leading-tight md:text-xl">{name}</h1>
        <p className="text-sm text-muted-foreground">Agende uma visita</p>
      </div>
    </header>
  );
}

interface VisitTypePickerProps {
  visitTypes: VisitType[];
  selectedId: string | null;
  disabled: boolean;
  onSelect: (id: string) => void;
}

function VisitTypePicker({ visitTypes, selectedId, disabled, onSelect }: VisitTypePickerProps) {
  if (visitTypes.length === 1) {
    const only = visitTypes[0];
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--brand-line)_14%,transparent)]">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{only.label}</p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(only.durationMin)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground" id="booking-visit-type">
        Tipo de visita
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1" role="group" aria-labelledby="booking-visit-type">
        {visitTypes.map((type) => {
          const active = type.id === selectedId;
          return (
            <button
              key={type.id}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onSelect(type.id)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left transition disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-line)] focus-visible:ring-offset-2",
                active
                  ? "border-[var(--brand-line)] ring-1 ring-[var(--brand-line)]"
                  : "hover:border-[color-mix(in_oklab,var(--brand-line)_50%,var(--border))]",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{type.label}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(type.durationMin)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                  active ? "border-[var(--brand-line)] bg-[var(--brand)] text-[var(--brand-fg)]" : "border-border",
                )}
              >
                {active && <Check className="h-3 w-3" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HowItWorks({ companyName }: { companyName: string }) {
  const steps = [
    { icon: CalendarDays, text: "Escolha o dia e o horário que ficam bons para você." },
    { icon: MessageCircle, text: "Deixe seu nome e telefone para contato." },
    { icon: CalendarCheck2, text: `A ${companyName} confirma a visita com você.` },
  ];
  return (
    <div className="hidden space-y-3 lg:block">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Como funciona</p>
      <ol className="space-y-3">
        {steps.map((item, index) => (
          <li key={index} className="flex gap-3 text-sm text-muted-foreground">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card">
              <item.icon className="h-3.5 w-3.5" />
            </span>
            <span className="pt-1">{item.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const items: Array<{ id: Step; label: string }> = [
    { id: "slot", label: "Dia e horário" },
    { id: "form", label: "Seus dados" },
  ];
  const currentIndex = items.findIndex((item) => item.id === step);
  return (
    <ol className="flex items-center gap-3" aria-label="Etapas">
      {items.map((item, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <React.Fragment key={item.id}>
            {index > 0 && <li aria-hidden="true" className="h-px w-8 bg-border" />}
            <li className="flex items-center gap-2" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  current || done
                    ? "bg-[var(--brand)] text-[var(--brand-fg)] ring-1 ring-[var(--brand-line)]"
                    : "border bg-card text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className={cn("text-sm", current ? "font-semibold" : "text-muted-foreground")}>{item.label}</span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}

interface SentStateProps {
  companyName: string;
  label: string;
  when: string;
  byEmail: boolean;
}

function SentState({ companyName, label, when, byEmail }: SentStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center md:py-12">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CalendarCheck2 className="h-8 w-8" />
      </span>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Pedido enviado</h2>
        <p className="text-muted-foreground">
          {label}, {when}.
        </p>
      </div>
      <div className="w-full max-w-md space-y-2 rounded-xl border bg-muted/30 p-4 text-left">
        <p className="text-sm font-medium">E agora?</p>
        <p className="text-sm text-muted-foreground">
          O horário ficou reservado para você. A {companyName} vai confirmar o horário com você
          {byEmail ? " por e-mail ou telefone." : " por telefone."}
        </p>
      </div>
    </div>
  );
}
