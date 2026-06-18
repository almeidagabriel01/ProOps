"use client";

import { motion } from "motion/react";
import { Clock, Globe, Video } from "lucide-react";
import type { DurationMinutes } from "@/lib/booking/slots";

interface HostCardProps {
  duration: DurationMinutes;
  onDurationChange: (d: DurationMinutes) => void;
}

const DURATIONS: { value: DurationMinutes; label: string }[] = [
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const item = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay: 0.55 + i * 0.08 },
});

export function HostCard({ duration, onDurationChange }: HostCardProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* identidade do host */}
      <motion.div {...item(0)} className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-black shadow-[0_8px_22px_-8px_rgba(0,0,0,0.5)] dark:border-white/15">
          <div
            aria-hidden
            className="h-6 w-6 bg-[url('/logo/logo2-cropped.svg')] bg-contain bg-[position:52%_51%] bg-no-repeat"
          />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45 dark:text-white/45">
            Time ProOps
          </p>
          <p className="text-sm font-semibold tracking-tight">
            Conversa de demonstração
          </p>
        </div>
      </motion.div>

      <motion.div {...item(1)} className="h-px w-full bg-black/8 dark:bg-white/10" />

      {/* seletor de duração */}
      <motion.div {...item(2)} className="flex flex-col gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/40">
          Duração
        </span>
        <div className="relative inline-flex w-fit rounded-full border border-black/12 p-1 dark:border-white/15">
          {DURATIONS.map((d) => {
            const active = d.value === duration;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => onDurationChange(d.value)}
                className="relative px-4 py-1.5 text-xs font-semibold"
              >
                {active && (
                  <motion.span
                    layoutId="duration-pill"
                    className="absolute inset-0 rounded-full bg-black dark:bg-white"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span
                  className={
                    active
                      ? "relative z-10 text-white dark:text-black"
                      : "relative z-10 text-black/55 transition-colors hover:text-black dark:text-white/55 dark:hover:text-white"
                  }
                >
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* meta */}
      <motion.div
        {...item(3)}
        className="flex flex-col gap-2.5 text-sm text-black/65 dark:text-white/65"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 opacity-55" />
          <span>Reunião de {duration === 60 ? "1 hora" : `${duration} minutos`}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Video className="h-4 w-4 opacity-55" />
          <span>Vídeochamada — link enviado por email</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 opacity-55" />
          <span>America/Sao_Paulo</span>
        </div>
      </motion.div>
    </div>
  );
}
