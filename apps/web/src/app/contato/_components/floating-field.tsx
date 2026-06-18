"use client";

import React, { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";

type FieldType = "text" | "email" | "tel";

interface FloatingFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: FieldType;
  required?: boolean;
  multiline?: boolean;
  autoComplete?: string;
  /** index used to stagger the entrance animation */
  index?: number;
}

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Mesma máscara BR do PhoneInput: (XX) XXXXX-XXXX */
function maskPhone(val: string): string {
  let digits = val.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Campo de formulário fora do padrão: sem caixinha — apenas uma linha de base
 * que se "desenha" da esquerda no foco, com o rótulo agindo como placeholder e
 * flutuando pra cima (por mola) quando há foco ou valor. Mono. Honra
 * prefers-reduced-motion (sem mola, sem desenho).
 */
export function FloatingField({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  required,
  multiline,
  autoComplete,
  index = 0,
}: FloatingFieldProps) {
  const reduce = useReducedMotion();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (type === "tel") {
      const formatted = maskPhone(e.target.value);
      onChange({
        ...e,
        target: { ...e.target, name, value: formatted },
      } as React.ChangeEvent<HTMLInputElement>);
      return;
    }
    onChange(e);
  };

  const labelTransition = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 34 };

  // campo: o texto digitado começa abaixo da zona onde o rótulo flutua
  const fieldClasses =
    "peer block w-full bg-transparent pt-6 text-base leading-tight text-black outline-none dark:text-white";

  return (
    <motion.div
      className="relative"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.45 + index * 0.08 }}
    >
      {/* rótulo: placeholder em repouso, flutua no topo quando ativo */}
      <motion.label
        htmlFor={id}
        className="pointer-events-none absolute left-0 top-0 origin-left select-none font-medium tracking-tight text-black/45 dark:text-white/45"
        animate={{ y: floated ? 0 : 24, scale: floated ? 0.8 : 1 }}
        transition={labelTransition}
      >
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 align-super text-[0.7em] text-black/35 dark:text-white/35">
            *
          </span>
        )}
      </motion.label>

      {multiline ? (
        <textarea
          id={id}
          name={name}
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={3}
          aria-invalid={!!error}
          className={cn(fieldClasses, "min-h-[3rem] resize-none pb-2")}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type === "tel" ? "tel" : type}
          inputMode={type === "tel" ? "numeric" : undefined}
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={cn(fieldClasses, "pb-2")}
        />
      )}

      {/* trilho de base + linha que se desenha */}
      <div className="relative h-px w-full bg-black/15 dark:bg-white/20">
        <motion.span
          aria-hidden
          className="absolute inset-0 origin-left bg-black dark:bg-white"
          initial={false}
          animate={{ scaleX: focused || error ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT }}
        />
      </div>

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="err"
            role="alert"
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
            className="mt-2 text-[0.78rem] italic text-black/60 dark:text-white/60"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
