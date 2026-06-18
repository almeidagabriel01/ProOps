"use client";

import { AnimatePresence, motion } from "motion/react";
import { LandingButton } from "@/components/landing/_shared/landing-button";

interface BookingSuccessProps {
  open: boolean;
  dateLabel: string;
  timeLabel: string;
  onReset: () => void;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function BookingSuccess({ open, dateLabel, timeLabel, onReset }: BookingSuccessProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white px-6 dark:bg-neutral-950"
        >
          <div className="flex max-w-md flex-col items-center text-center">
            <motion.svg
              width="72"
              height="72"
              viewBox="0 0 72 72"
              className="mb-8"
              initial="hidden"
              animate="visible"
            >
              <motion.circle
                cx="36"
                cy="36"
                r="34"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                variants={{
                  hidden: { pathLength: 0, opacity: 0 },
                  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: EASE } },
                }}
              />
              <motion.path
                d="M22 37l10 10 18-20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                variants={{
                  hidden: { pathLength: 0 },
                  visible: { pathLength: 1, transition: { duration: 0.5, delay: 0.4, ease: EASE } },
                }}
              />
            </motion.svg>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              className="text-3xl font-bold [font-family:var(--font-pdf-montserrat)]"
            >
              Demonstração confirmada!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.62, ease: EASE }}
              className="mt-3 text-black/65 dark:text-white/65"
            >
              {dateLabel} · {timeLabel}. Enviamos a confirmação por email.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.74, ease: EASE }}
              className="mt-8"
            >
              <LandingButton variant="solid" size="md" onClick={onReset}>
                Agendar outra
              </LandingButton>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
