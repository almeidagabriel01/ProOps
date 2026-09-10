"use client";

import React, { useRef } from "react";
import { m as motion, useTransform } from "motion/react";

import { ScrubCounter } from "@/components/marketing/_shared/scrub-counter";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { cn } from "@/lib/utils";

import type { Numero } from "@/app/institucional/_content/institucional-copy";

/**
 * The publishable numbers, counted by the reader's own scroll.
 *
 * A time-based count-up (`useCountUp`) fires once on entry and runs on its own
 * clock, so scrolling back up and down again shows nothing the second time.
 * Tying the digits to scroll progress makes the reader the one turning the dial,
 * which is the difference between a mechanism and a decoration.
 *
 * The numbers are ZERO in the content file, deliberately, and the counter
 * therefore counts 0 to 0 until real figures are confirmed. That is the intended
 * warning: an invented number on a company page stops being a draft and becomes
 * a claim, and it is the first thing a prospect checks.
 *
 * The rule under each figure draws as its number lands, which is what stops
 * three big zeros from reading as an empty grid.
 */
export function NumerosScrubados({
  numeros,
  tom = "escuro",
  className,
}: {
  numeros: Numero[];
  tom?: "escuro" | "claro";
  className?: string;
}) {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, {
    // The band is not a full-height scene, so it needs a window that maps its
    // arrival into 0..1 rather than the default "scrolled fully past".
    start: "top 85%",
    end: "bottom 55%",
    fallback: 1,
  });

  return (
    <div
      ref={trilha}
      className={cn(
        // A quantidade sai da lista, e não de um número escrito na classe: os
        // números publicáveis mudam conforme forem confirmados, e uma grade de
        // três com dois itens deixa uma célula vazia com borda, que parece um
        // dado que não carregou.
        "grid gap-px",
        numeros.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
        tom === "escuro" ? "bg-white/10" : "bg-black/10",
        className,
      )}
    >
      {numeros.map((numero, index) => (
        <Figura
          key={numero.rotulo}
          numero={numero}
          indice={index}
          total={numeros.length}
          progresso={progress}
          animado={animated}
          tom={tom}
        />
      ))}
    </div>
  );
}

function Figura({
  numero,
  indice,
  total,
  progresso,
  animado,
  tom,
}: {
  numero: Numero;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
  tom: "escuro" | "claro";
}) {
  const fatia = 0.55 / total;
  const de = 0.1 + indice * fatia;
  const ate = de + fatia * 2.2;
  const escalaRegua = useTransform(progresso, [de, ate], [0, 1]);

  return (
    <div
      className={cn(
        "relative px-7 py-10 md:px-9 md:py-12",
        tom === "escuro" ? "bg-neutral-950" : "bg-white",
      )}
    >
      <p
        className={cn(
          "[font-family:var(--font-bricolage)] text-[clamp(3rem,8vw,4.5rem)] font-extrabold leading-none tracking-[-0.05em]",
          tom === "escuro" ? "text-white" : "text-black",
        )}
      >
        <ScrubCounter
          progresso={progresso}
          de={de}
          ate={ate}
          valor={numero.valor}
          prefixo={numero.prefixo}
          sufixo={numero.sufixo}
          digitos={numero.digitos}
        />
      </p>
      <motion.span
        aria-hidden="true"
        style={animado ? { scaleX: escalaRegua } : { scaleX: 1 }}
        className={cn(
          "mt-6 block h-px w-full origin-left",
          tom === "escuro" ? "bg-white/50" : "bg-black/40",
        )}
      />
      <p
        className={cn(
          "mt-5 max-w-[22ch] text-sm leading-relaxed",
          tom === "escuro" ? "text-white/55" : "text-black/55",
        )}
      >
        {numero.rotulo}
      </p>
    </div>
  );
}
