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

export function HostCard({ duration, onDurationChange }: HostCardProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
          <span className="text-lg font-bold [font-family:var(--font-pdf-montserrat)]">P</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
            Time ProOps
          </p>
          <p className="text-sm font-semibold">Conversa de demonstração</p>
        </div>
      </div>

      <h1 className="text-3xl font-bold leading-[1.05] tracking-tight [font-family:var(--font-pdf-montserrat)] md:text-4xl">
        Vamos marcar
        <br />
        uma reunião.
      </h1>

      <p className="max-w-xs text-sm leading-relaxed text-black/60 dark:text-white/60">
        Escolha o dia e o horário. A gente mostra a ProOps funcionando no seu
        contexto — sem compromisso.
      </p>

      <div className="flex flex-col gap-3 text-sm text-black/70 dark:text-white/70">
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 opacity-60" />
          <div className="relative inline-flex rounded-full border border-black/12 p-1 dark:border-white/15">
            {DURATIONS.map((d) => {
              const active = d.value === duration;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onDurationChange(d.value)}
                  className="relative px-3.5 py-1 text-xs font-semibold"
                >
                  {active && (
                    <motion.span
                      layoutId="duration-pill"
                      className="absolute inset-0 rounded-full bg-black dark:bg-white"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span
                    className={
                      active
                        ? "relative z-10 text-white dark:text-black"
                        : "relative z-10 text-black/60 dark:text-white/60"
                    }
                  >
                    {d.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Video className="h-4 w-4 opacity-60" />
          <span>Vídeochamada (link enviado por email)</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 opacity-60" />
          <span>America/Sao_Paulo</span>
        </div>
      </div>
    </div>
  );
}
