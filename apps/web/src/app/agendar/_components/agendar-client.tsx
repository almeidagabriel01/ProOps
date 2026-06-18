"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import { LandingNavbar, LandingFooter, useLandingPage } from "@/components/landing";
import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import {
  DemoBookingService,
  type AvailabilityBooking,
} from "@/services/demo-booking-service";
import {
  generateSlotStarts,
  isSlotAvailable,
  minutesToLabel,
  nowSaoPaulo,
  type BookedInterval,
  type DurationMinutes,
} from "@/lib/booking/slots";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { DemoBookingFormData } from "@/lib/validations/demo-booking";
import { HostCard } from "./host-card";
import { BookingCalendar } from "./booking-calendar";
import { SlotsPanel } from "./slots-panel";
import { BookingSuccess } from "./booking-success";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Linhas do título que escorregam de baixo p/ cima no load. */
function RisingTitle({ lines, reduce }: { lines: string[]; reduce: boolean }) {
  return (
    <h1 className="text-4xl font-bold leading-[0.96] tracking-tight [font-family:var(--font-pdf-montserrat)] md:text-[2.6rem]">
      {lines.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.06em]">
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: "110%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.12 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export function AgendarClient() {
  const reduce = useReducedMotion();
  const { currentUser, isAuthLoading, handleSignOut } = useLandingPage();

  const initial = useMemo(() => nowSaoPaulo(), []);
  const [todayStr] = useState(initial.dateStr);
  const [now] = useState(initial);

  const [year, setYear] = useState(() => Number(initial.dateStr.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(initial.dateStr.slice(5, 7)));
  const [duration, setDuration] = useState<DurationMinutes>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookings, setBookings] = useState<AvailabilityBooking[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [panelResetKey, setPanelResetKey] = useState(0);
  const [success, setSuccess] = useState<{ dateLabel: string; timeLabel: string } | null>(null);

  // Carrega disponibilidade do mês visível.
  useEffect(() => {
    let active = true;
    DemoBookingService.getAvailability(monthKey(year, month))
      .then((r) => {
        if (active) setBookings(r.bookings);
      })
      .catch(() => {
        if (active) setBookings([]);
      });
    return () => {
      active = false;
    };
  }, [year, month]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookedInterval[]>();
    for (const b of bookings) {
      const arr = map.get(b.date) ?? [];
      arr.push(b);
      map.set(b.date, arr);
    }
    return map;
  }, [bookings]);

  // Um dia está "lotado" se NENHUM slot da duração atual está livre.
  const fullyBookedDates = useMemo(() => {
    const full = new Set<string>();
    const starts = generateSlotStarts(duration);
    for (const [date, dayBookings] of bookingsByDate) {
      const anyFree = starts.some((s) => isSlotAvailable(s, duration, dayBookings));
      if (!anyFree) full.add(date);
    }
    return full;
  }, [bookingsByDate, duration]);

  function goPrevMonth() {
    setSelectedDate(null);
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  }
  function goNextMonth() {
    setSelectedDate(null);
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  }

  function refetchMonth() {
    DemoBookingService.getAvailability(monthKey(year, month))
      .then((r) => setBookings(r.bookings))
      .catch(() => {});
  }

  function shortDateHeading(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][
      new Date(y, m - 1, d).getDay()
    ];
    return `${dow}. ${d}`;
  }

  function longDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const months = [
      "jan", "fev", "mar", "abr", "mai", "jun",
      "jul", "ago", "set", "out", "nov", "dez",
    ];
    return `${d} de ${months[m - 1]} de ${y}`;
  }

  async function handleConfirm(startMinutes: number, form: DemoBookingFormData) {
    if (!selectedDate) return;
    setIsSubmitting(true);
    try {
      await DemoBookingService.book({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        company: form.company || undefined,
        message: form.message || undefined,
        date: selectedDate,
        startMinutes,
        durationMinutes: duration,
        website: form.website ?? "",
      });
      setSuccess({
        dateLabel: longDateLabel(selectedDate),
        timeLabel: `${minutesToLabel(startMinutes)}–${minutesToLabel(startMinutes + duration)}`,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Este horário acabou de ser reservado. Escolha outro.");
        refetchMonth();
        setPanelResetKey((k) => k + 1);
      } else if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Erro ao agendar. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setSuccess(null);
    setSelectedDate(null);
    refetchMonth();
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      {/* atmosfera de fundo */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[55vh] w-[130vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.06),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.07),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <LandingNavbar
        currentUser={currentUser}
        isAuthLoading={isAuthLoading}
        onSignOut={handleSignOut}
      />

      <main className="mx-auto max-w-7xl px-6 lg:px-10">
        <section className="flex min-h-svh items-center pt-24 pb-10">
          <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.55fr)] lg:items-center lg:gap-16">
            {/* coluna narrativa — título + host + duração */}
            <div className="flex flex-col gap-7">
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50 dark:text-white/55"
              >
                <span className="h-px w-7 bg-black/30 dark:bg-white/40" />
                Agendamento
              </motion.div>

              <RisingTitle reduce={reduce} lines={["Agende uma", "demonstração."]} />

              <motion.p
                initial={reduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, ease: EASE, delay: 0.5 }}
                className="max-w-sm text-base leading-relaxed text-black/60 dark:text-white/60"
              >
                Escolha um dia e um horário — enviamos o link da videochamada
                por email. Uma demonstração direta da ProOps, sem compromisso.
              </motion.p>

              <HostCard
                duration={duration}
                onDurationChange={(d) => {
                  setDuration(d);
                  setSelectedDate(null);
                }}
              />
            </div>

            {/* card interativo — calendário + horários lado a lado */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.85, ease: EASE, delay: 0.2 }}
              className="rounded-[1.75rem] border border-black/10 bg-white/70 p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.4)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/50 md:p-7"
            >
              <div className="grid gap-7 sm:grid-cols-[1fr_minmax(0,248px)] sm:gap-8">
                <BookingCalendar
                  viewYear={year}
                  viewMonth={month}
                  todayStr={todayStr}
                  selectedDate={selectedDate}
                  fullyBookedDates={fullyBookedDates}
                  reduce={reduce}
                  duration={duration}
                  onPrevMonth={goPrevMonth}
                  onNextMonth={goNextMonth}
                  onSelectDate={setSelectedDate}
                />

                <div className="sm:border-l sm:border-black/8 sm:pl-8 dark:sm:border-white/10">
                  <AnimatePresence mode="wait">
                    {selectedDate ? (
                      <motion.div
                        key={`${selectedDate}-${panelResetKey}`}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ duration: 0.4, ease: EASE }}
                      >
                        <SlotsPanel
                          dateStr={selectedDate}
                          dateHeading={shortDateHeading(selectedDate)}
                          duration={duration}
                          dayBookings={bookingsByDate.get(selectedDate) ?? []}
                          now={now}
                          isSubmitting={isSubmitting}
                          onConfirm={handleConfirm}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex min-h-[300px] flex-col justify-center gap-3"
                      >
                        <div className="h-10 w-10 rounded-2xl border border-dashed border-black/20 dark:border-white/20" />
                        <p className="max-w-[12rem] text-sm leading-relaxed text-black/45 dark:text-white/45">
                          Selecione um dia no calendário para ver os horários.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <LandingFooter />
      <BookingSuccess
        open={success !== null}
        dateLabel={success?.dateLabel ?? ""}
        timeLabel={success?.timeLabel ?? ""}
        onReset={handleReset}
      />
    </div>
  );
}
