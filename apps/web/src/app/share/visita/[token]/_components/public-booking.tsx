"use client";

import * as React from "react";
import Image from "next/image";
import { AlertCircle, CalendarCheck2, CalendarClock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Loader } from "@/components/ui/loader";
import { Textarea } from "@/components/ui/textarea";
import { getCaptchaToken, isCaptchaConfigured, mountCaptcha } from "@/lib/captcha";
import { cn } from "@/lib/utils";
import { brandButtonStyle } from "@/utils/color-utils";
import { describeBookingWhen, formatMinutes, shortDayLabel } from "@/lib/booking/booking-format";
import { BookingService, type PublicBookingView } from "@/services/booking-service";

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

const EMPTY_FORM: ContactForm = { name: "", phone: "", email: "", address: "", notes: "", website: "" };

function errorStatus(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : undefined;
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
  const [chosen, setChosen] = React.useState<Chosen | null>(null);
  const [form, setForm] = React.useState<ContactForm>(EMPTY_FORM);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState<{ label: string; when: string } | null>(null);

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
  const activeDate = date && days.some((d) => d.date === date) ? date : days[0]?.date ?? null;
  const starts = days.find((d) => d.date === activeDate)?.starts ?? [];
  const visitType = view?.visitTypes.find((t) => t.id === visitTypeId) ?? null;

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
        void load();
      } else {
        setSubmitError(error instanceof Error && error.message ? error.message : "Não foi possível enviar. Tente de novo.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center gap-3">
          {view.company.logoUrl ? (
            <Image
              src={view.company.logoUrl}
              alt={view.company.name}
              width={48}
              height={48}
              unoptimized
              className="h-12 w-12 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarClock className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{view.company.name}</h1>
            <p className="text-sm text-muted-foreground">Agende uma visita</p>
          </div>
        </header>

        {sent ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <CalendarCheck2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h2 className="text-xl font-semibold">Pedido enviado</h2>
              <p className="text-muted-foreground">
                {sent.label}, {sent.when}.
              </p>
              <p className="text-sm text-muted-foreground">
                A {view.company.name} vai confirmar o horário com você
                {form.email.trim() ? " por e-mail ou telefone." : " por telefone."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-6 pt-6">
              {view.visitTypes.length > 1 && (
                <section className="space-y-2">
                  <h2 className="text-sm font-medium">Tipo de visita</h2>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de visita">
                    {view.visitTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        aria-pressed={type.id === visitTypeId}
                        onClick={() => {
                          setVisitTypeId(type.id);
                          setChosen(null);
                        }}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition",
                          type.id === visitTypeId
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-muted",
                        )}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {days.length === 0 ? (
                <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Não há horário livre nos próximos dias. Fale com a {view.company.name} para combinar.
                </p>
              ) : (
                <>
                  <section className="space-y-2">
                    <h2 className="text-sm font-medium">Dia</h2>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Dia">
                      {days.map((day) => {
                        const label = shortDayLabel(day.date);
                        const active = day.date === activeDate;
                        return (
                          <button
                            key={day.date}
                            type="button"
                            aria-pressed={active}
                            aria-label={`${label.weekday} ${label.day}`}
                            onClick={() => {
                              setDate(day.date);
                              setChosen(null);
                            }}
                            className={cn(
                              "flex min-w-16 shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-sm transition",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            <span className="capitalize">{label.weekday}</span>
                            <span className="font-semibold">{label.day}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-sm font-medium">Horário</h2>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Horário">
                      {starts.map((start) => {
                        const active = chosen?.date === activeDate && chosen?.startMin === start;
                        return (
                          <button
                            key={start}
                            type="button"
                            aria-pressed={active}
                            onClick={() => activeDate && setChosen({ date: activeDate, startMin: start })}
                            className={cn(
                              "rounded-lg border py-2 text-sm tabular-nums transition",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:bg-muted",
                            )}
                          >
                            {formatMinutes(start)}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}

              {chosen && visitType && (
                <form onSubmit={(e) => void submit(e)} className="space-y-4 border-t pt-6">
                  <p className="text-sm">
                    <span className="font-medium">{visitType.label}</span>,{" "}
                    {describeBookingWhen(chosen.date, chosen.startMin)}
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    O horário fica reservado e a {view.company.name} confirma com você.
                  </p>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={submitting}
                    style={brandButtonStyle(view.company.primaryColor)}
                  >
                    {submitting && <Loader size="sm" variant="button" className="mr-2" />}
                    Pedir a visita
                  </Button>
                </form>
              )}

              {!chosen && submitError && (
                <p role="alert" className="text-sm text-destructive">
                  {submitError}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
