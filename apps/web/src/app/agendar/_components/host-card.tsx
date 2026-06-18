"use client";

import { motion } from "motion/react";
import { Clock, Globe, Video } from "lucide-react";
import { ProOpsLogo } from "@/components/branding/proops-logo";
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

// entrada em cascata de cada bloco do card
const item = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: EASE, delay: 0.05 + i * 0.08 },
});

export function HostCard({ duration, onDurationChange }: HostCardProps) {
  return (
    <div className="flex flex-col gap-7">
      {/* identidade do host */}
      <motion.div {...item(0)} className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white shadow-[0_6px_20px_-8px_rgba(0,0,0,0.3)] dark:border-white/15 dark:bg-neutral-900">
          <ProOpsLogo
            variant="symbol"
            width={28}
            height={28}
            invertOnDark
            interactive={false}
            className="h-7 w-7"
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

      <motion.p
        {...item(1)}
        className="max-w-xs text-[15px] leading-relaxed text-black/60 dark:text-white/60"
      >
        Escolha o dia e o horário. A gente mostra a ProOps funcionando no seu
        contexto — sem compromisso, sem enrolação.
      </motion.p>

      <motion.div {...item(2)} className="h-px w-full bg-black/8 dark:bg-white/10" />

      {/* seletor de duração */}
      <motion.div {...item(3)} className="flex flex-col gap-3">
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
        {...item(4)}
        className="flex flex-col gap-3 text-sm text-black/65 dark:text-white/65"
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
