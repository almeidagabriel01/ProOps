"use client";

import React, { useEffect, useRef } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";

interface ContactSuccessProps {
  open: boolean;
  onReset: () => void;
}

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Takeover de tela cheia ao enviar: a tinta toma a tela, um checkmark é
 * desenhado por pathLength e "ENVIADO" sobe escalonado. Mono. Sob
 * prefers-reduced-motion: fade simples, sem bloom nem desenho.
 */
export function ContactSuccess({ open, onReset }: ContactSuccessProps) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      // move o foco pro overlay quando abre (leitor de tela anuncia o status)
      const t = window.setTimeout(() => panelRef.current?.focus(), reduce ? 0 : 900);
      return () => window.clearTimeout(t);
    }
  }, [open, reduce]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="status"
          aria-live="polite"
          tabIndex={-1}
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden bg-black text-white outline-none dark:bg-white dark:text-black"
          initial={reduce ? { opacity: 0 } : { opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.2 : 0.4, ease: EASE_OUT }}
        >
          {/* ink bloom: círculo escala do centro preenchendo a tela */}
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute left-1/2 top-1/2 aspect-square w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black dark:bg-white"
              initial={{ scale: 0 }}
              animate={{ scale: 360 }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
            />
          )}

          <div className="relative flex flex-col items-center px-6 text-center">
            {/* checkmark desenhado */}
            <svg
              viewBox="0 0 120 120"
              className="mb-8 h-24 w-24"
              fill="none"
              aria-hidden
            >
              <motion.circle
                cx="60"
                cy="60"
                r="54"
                stroke="currentColor"
                strokeWidth="2"
                strokeOpacity={0.35}
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduce ? 0 : 0.8, ease: EASE_OUT }}
              />
              <motion.path
                d="M38 62 L54 78 L84 44"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: reduce ? 0 : 0.55,
                  ease: EASE_OUT,
                  delay: reduce ? 0 : 0.5,
                }}
              />
            </svg>

            <motion.h2
              className="[font-family:var(--font-pdf-montserrat)] text-4xl font-bold tracking-tight md:text-6xl"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: reduce ? 0 : 0.95 }}
            >
              Mensagem enviada
            </motion.h2>

            <motion.p
              className="mt-4 max-w-md text-base text-white/70 dark:text-black/65"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: reduce ? 0 : 1.08 }}
            >
              Recebemos seu contato. Nossa equipe retornará por email em breve.
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: reduce ? 0 : 1.2 }}
              className="mt-10"
            >
              <LandingButton variant="inverted" size="md" onClick={onReset}>
                Enviar outra mensagem
              </LandingButton>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
