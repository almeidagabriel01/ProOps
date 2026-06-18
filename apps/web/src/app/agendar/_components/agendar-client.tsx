"use client";

import { useEffect, useMemo, useState } from "react";
import { LandingNavbar, LandingFooter, useLandingPage } from "@/components/landing";
import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import {
  DemoBookingService,
  type AvailabilityBooking,
} from "@/services/demo-booking-service";
import {
  generateSlotStarts,
  isSlotAvailable,
  nowSaoPaulo,
  type BookedInterval,
  type DurationMinutes,
} from "@/lib/booking/slots";
import { HostCard } from "./host-card";
import { BookingCalendar } from "./booking-calendar";

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function AgendarClient() {
  const reduce = useReducedMotion();
  const { currentUser, isAuthLoading, handleSignOut } = useLandingPage();

  const initial = useMemo(() => nowSaoPaulo(), []);
  const [todayStr] = useState(initial.dateStr);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [now] = useState(initial);

  const [year, setYear] = useState(() => Number(initial.dateStr.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(initial.dateStr.slice(5, 7)));
  const [duration, setDuration] = useState<DurationMinutes>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookings, setBookings] = useState<AvailabilityBooking[]>([]);

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

            {/* Painel de slots + form entra na Task 9 */}
            <div aria-hidden className="hidden lg:block" />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

export { nowSaoPaulo };
