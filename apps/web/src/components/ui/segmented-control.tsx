"use client";

import * as React from "react";
import { m as motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Alternância entre visões de uma mesma tela.
 *
 * Nasceu dentro do módulo financeiro (Lista / Agrupados) e subiu para cá quando
 * as notas fiscais precisaram do mesmo controle: alternar emitidas e recebidas
 * com o `Tabs` genérico dava àquela tela uma cara que não existe em nenhuma
 * outra do grupo. Duas superfícies copiando o mesmo visual é o momento de o
 * componente virar primitivo, não de duplicar as classes.
 *
 * Não confundir com `Tabs`: aquele é para painéis independentes dentro de um
 * formulário ou diálogo; este é o seletor de visão de uma listagem.
 */

interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  /**
   * Contagem ao lado do rótulo. `undefined` não desenha nada: numa lista que
   * ainda está carregando, um `0` provisório afirma o que não se sabe.
   */
  count?: number;
}

interface SegmentedControlProps {
  id: string;
  options: SegmentedOption[];
  value: string;
  onChange: (v: string) => void;
}

export function SegmentedControl({
  id,
  options,
  value,
  onChange,
}: SegmentedControlProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label={id}
      className="bg-muted/60 p-1 rounded-xl inline-flex items-center gap-0.5"
    >
      {options.map((opt) => {
        const isActive = opt.value === value;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            className={cn(
              "relative h-8 px-3 rounded-lg text-xs font-medium",
              "transition-colors duration-150 cursor-pointer whitespace-nowrap",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
              isActive && shouldReduceMotion && "bg-card shadow-sm",
            )}
          >
            {/* Background rendered first so text stacks on top via DOM order */}
            <AnimatePresence>
              {isActive && !shouldReduceMotion && (
                <motion.div
                  key="active-bg"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute inset-0 rounded-[0.45rem] bg-card shadow-sm"
                />
              )}
            </AnimatePresence>
            <span className="relative flex items-center gap-1.5">
              {opt.icon}
              {opt.label}
              {typeof opt.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-foreground/10 text-muted-foreground",
                  )}
                >
                  {opt.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
