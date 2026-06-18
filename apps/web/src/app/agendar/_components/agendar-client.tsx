"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
    <h1 className="text-5xl font-bold leading-[0.95] tracking-tight [font-family:var(--font-pdf-montserrat)] md:text-7xl">
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

      <main className="mx-auto max-w-6xl px-6">
        {/* banda hero */}
        <section className="pt-36 pb-12 md:pt-44">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="mb-6 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50 dark:text-white/55"
          >
            <span className="h-px w-7 bg-black/30 dark:bg-white/40" />
            Agendamento
          </motion.div>

          <RisingTitle reduce={reduce} lines={["Vamos marcar", "uma reunião."]} />

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE, delay: 0.5 }}
            className="mt-7 max-w-lg text-lg leading-relaxed text-black/60 dark:text-white/60"
          >
            Escolha um dia, um horário e pronto — a gente envia o link da
            videochamada por email. Uma conversa direta sobre a ProOps no seu
            contexto.
          </motion.p>
        </section>

        {/* superfície de agendamento — revela ao entrar na viewport */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: EASE }}
          className="mb-24 rounded-[2rem] border border-black/10 bg-white/70 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/50 md:p-10"
        >
          <div className="grid gap-10 lg:grid-cols-[260px_1fr_minmax(0,340px)] lg:gap-12">
            <HostCard
              duration={duration}
              onDurationChange={(d) => {
                setDuration(d);
                setSelectedDate(null);
              }}
            />

            <div className="lg:border-x lg:border-black/8 lg:px-12 dark:lg:border-white/10">
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
            </div>

            <div className="lg:pl-2">
              <AnimatePresence mode="wait">
                {selectedDate ? (
                  <motion.div
                    key={`${selectedDate}-${panelResetKey}`}
                    initial={{ opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 32 }}
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
                    className="hidden h-full flex-col justify-center gap-3 lg:flex"
                  >
                    <div className="h-10 w-10 rounded-2xl border border-dashed border-black/20 dark:border-white/20" />
                    <p className="max-w-[12rem] text-sm leading-relaxed text-black/45 dark:text-white/45">
                      Selecione um dia no calendário para ver os horários
                      disponíveis.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>
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
