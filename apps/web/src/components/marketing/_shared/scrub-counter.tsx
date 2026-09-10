"use client";

import React, { useEffect, useRef, useState } from "react";
import { type MotionValue } from "motion/react";

interface ScrubCounterProps {
  /** Section progress, 0 to 1, from `useScrollProgress`. */
  progresso: MotionValue<number>;
  /** Where in that progress this number starts and finishes counting. */
  de?: number;
  ate?: number;
  /** The final number. Non-numeric text around it goes in the props below. */
  valor: number;
  /** Rendered before and after the digits, e.g. "R$ " and " mil". */
  prefixo?: string;
  sufixo?: string;
  /** Pads with leading zeros so the box does not resize as digits appear. */
  digitos?: number;
  className?: string;
}

/**
 * A number driven by scroll position, not by a clock.
 *
 * The difference matters: a time-based count-up (`useCountUp`) fires once when
 * the element enters and runs on its own, so scrolling back up and down again
 * shows nothing. Tying it to progress means the reader is the one turning the
 * dial, and it reads as a mechanism rather than a decoration.
 *
 * The DOM is written directly instead of through state. A `setState` per frame
 * re-renders the subtree sixty times a second for a text node; `textContent` on
 * a ref costs nothing and is what every scrubbed counter ends up doing.
 *
 * The markup ships the FINAL value, so a reader with reduced motion, or one
 * whose JavaScript never arrives, sees the real number rather than a zero.
 * `tabular-nums` keeps the digits from jittering as they change width.
 */
export function ScrubCounter({
  progresso,
  de = 0,
  ate = 1,
  valor,
  prefixo = "",
  sufixo = "",
  digitos,
  className,
}: ScrubCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [montado, setMontado] = useState(false);

  const formata = (n: number) =>
    digitos
      ? String(n).padStart(digitos, "0")
      : n.toLocaleString("pt-BR");

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!montado) return;
    const el = ref.current;
    if (!el) return;

    const pinta = (p: number) => {
      const faixa = Math.max(ate - de, 0.0001);
      const t = Math.max(0, Math.min(1, (p - de) / faixa));
      el.textContent = formata(Math.round(valor * t));
    };

    pinta(progresso.get());
    return progresso.on("change", pinta);
    // `formata` is derived from props already listed; adding it would rebuild
    // the subscription on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montado, progresso, de, ate, valor, digitos]);

  return (
    <span className={className}>
      {prefixo}
      <span ref={ref} className="tabular-nums">
        {formata(valor)}
      </span>
      {sufixo}
    </span>
  );
}
