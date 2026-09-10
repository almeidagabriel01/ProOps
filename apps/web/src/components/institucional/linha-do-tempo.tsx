"use client";

import React, { useRef } from "react";
import { m as motion, useTransform } from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { cn } from "@/lib/utils";

import type { Marco } from "@/app/institucional/_content/institucional-copy";

/**
 * The company's milestones, on a rule that draws itself as the reader descends.
 *
 * The vertical counterpart to the horizontal timeline on the root experience,
 * and the shape is different for a reason rather than for variety: the root is a
 * cinematic pass where a horizontal pin is the surprise, and this page is read.
 * A vertical list can be scanned, linked to and re-read, which is what someone
 * who navigated to "Sobre" came to do.
 *
 * The spine is one element scaled on Y, not a stack of segments: `scaleY` on a
 * single hairline is a compositor transform, while growing a height is layout on
 * every frame of the scroll.
 */
export function LinhaDoTempo({
  marcos,
  tom = "claro",
  className,
}: {
  marcos: Marco[];
  tom?: "escuro" | "claro";
  className?: string;
}) {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, {
    start: "top 70%",
    end: "bottom 80%",
    fallback: 1,
  });

  return (
    <div ref={trilha} className={cn("relative", className)}>
      {/* The spine. `left-[7px]` centres it under the 15px dots. */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute bottom-2 left-[7px] top-2 w-px",
          tom === "escuro" ? "bg-white/12" : "bg-black/10",
        )}
      >
        <motion.div
          style={animated ? { scaleY: progress } : { scaleY: 1 }}
          className={cn(
            "h-full w-px origin-top",
            tom === "escuro" ? "bg-white/60" : "bg-black/60",
          )}
        />
      </div>

      <ol className="space-y-14 md:space-y-20">
        {marcos.map((marco, index) => (
          <Item
            key={`${marco.ano}-${marco.titulo}`}
            marco={marco}
            indice={index}
            total={marcos.length}
            progresso={progress}
            animado={animated}
            tom={tom}
          />
        ))}
      </ol>
    </div>
  );
}

function Item({
  marco,
  indice,
  total,
  progresso,
  animado,
  tom,
}: {
  marco: Marco;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
  tom: "escuro" | "claro";
}) {
  // Each milestone lights just before the spine reaches it, so the rule appears
  // to arrive at something already there rather than to push it into place.
  const ponto = (indice + 0.5) / total;
  const de = Math.max(ponto - 0.16, 0);
  const ate = ponto;

  const opacity = useTransform(progresso, [de, ate], [0.28, 1]);
  const x = useTransform(progresso, [de, ate], [-14, 0]);
  const escalaPonto = useTransform(progresso, [de, ate], [0.4, 1]);

  return (
    <motion.li
      style={animado ? { opacity, x } : undefined}
      className="relative pl-10 md:pl-14"
    >
      <motion.span
        aria-hidden="true"
        style={animado ? { scale: escalaPonto } : undefined}
        className={cn(
          "absolute left-0 top-1.5 block h-[15px] w-[15px] rounded-full border",
          tom === "escuro"
            ? "border-white/40 bg-neutral-950"
            : "border-black/30 bg-white",
        )}
      >
        <span
          className={cn(
            "absolute inset-[4px] rounded-full",
            tom === "escuro" ? "bg-white" : "bg-black",
          )}
        />
      </motion.span>

      <p
        className={cn(
          "[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] tabular-nums",
          tom === "escuro" ? "text-white/45" : "text-black/40",
        )}
      >
        {marco.ano}
      </p>
      <h3
        className={cn(
          "mt-3 [font-family:var(--font-bricolage)] text-2xl font-semibold tracking-tight md:text-3xl",
          tom === "escuro" ? "text-white" : "text-black",
        )}
      >
        {marco.titulo}
      </h3>
      <p
        className={cn(
          "mt-3 max-w-xl text-sm leading-relaxed md:text-base",
          tom === "escuro" ? "text-white/55" : "text-black/55",
        )}
      >
        {marco.texto}
      </p>
    </motion.li>
  );
}
