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

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
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
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar
        currentUser={currentUser}
        isAuthLoading={isAuthLoading}
        onSignOut={handleSignOut}
      />
      <main>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[300px_1fr_minmax(0,360px)] lg:gap-12">
            <HostCard duration={duration} onDurationChange={(d) => { setDuration(d); setSelectedDate(null); }} />

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
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hidden text-sm text-black/40 dark:text-white/40 lg:block lg:pt-2"
                  >
                    Escolha um dia para ver os horários.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
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
