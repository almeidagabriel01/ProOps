"use client";

import React, { useRef } from "react";
import gsap from "gsap";

import { useHolofote } from "@/components/marketing/_shared/use-holofote";
import {
  SCENE_ANY_WIDTH,
  useScrollScene,
} from "@/components/marketing/_shared/use-scroll-scene";
import { cn } from "@/lib/utils";

export interface Bloco {
  titulo: string;
  texto: string;
}

interface BlocosReveladosProps {
  blocos: Bloco[];
  /** Numbered 01, 02, 03. Off for a list where order is not the point. */
  numerado?: boolean;
  tom?: "escuro" | "claro";
  colunas?: 2 | 3 | 4;
  className?: string;
}

/**
 * A hairline grid of short blocks, revealed on arrival.
 *
 * The grid is drawn with `gap-px` over a background, so the "borders" are the
 * background showing through a one-pixel gap. One line per edge instead of two
 * adjacent borders, no double-thickness where cells meet, and no `border-r
 * last:border-r-0` arithmetic that breaks the moment the column count changes at
 * a breakpoint.
 *
 * Three things carry the weight, and each is doing a job the others cannot:
 *
 * - a **ghost numeral** behind the copy, big enough to be texture rather than
 *   information, which is what stops a cell from being a paragraph in a box;
 * - a **spotlight** that follows the cursor ACROSS the grid, from one shared
 *   listener, so the light crosses cells as one moving thing instead of blinking
 *   per box;
 * - a **corner rule** that draws on hover, which suggests a frame without
 *   closing one: a full border on a monochrome card just makes it a box.
 *
 * The reveal is `fromTo` from the FINAL state, so the markup on screen without
 * JavaScript, and under `prefers-reduced-motion`, is the finished grid. It is a
 * one-shot (`once: true`) rather than a scrub: these are read, not watched, and
 * text that re-dims when the reader scrolls back up to re-read it is hostile.
 */
export function BlocosRevelados({
  blocos,
  numerado = true,
  tom = "escuro",
  colunas = 3,
  className,
}: BlocosReveladosProps) {
  const escopo = useRef<HTMLDivElement>(null);
  const holofote = useHolofote<HTMLDivElement>();
  const escuro = tom === "escuro";

  useScrollScene(
    escopo,
    () => {
      const celulas = gsap.utils.toArray<HTMLElement>(".bloco-revelado");
      if (!celulas.length) return;
      const tween = gsap.fromTo(
        celulas,
        { y: 26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "expo.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: escopo.current,
            start: "top 85%",
            once: true,
            invalidateOnRefresh: true,
          },
        },
      );
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { query: SCENE_ANY_WIDTH, dependencies: [blocos.length] },
  );

  const grade = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  }[colunas];

  return (
    // Two refs, two jobs: `escopo` is the GSAP scope for the reveal, `holofote`
    // owns the single pointer listener. Merging them would tie the light's
    // lifetime to a timeline that is meant to run once and be thrown away.
    <div ref={holofote}>
      <div
        ref={escopo}
        className={cn(
          "grid gap-px",
          grade,
          escuro ? "bg-white/10" : "bg-black/10",
          className,
        )}
      >
        {blocos.map((bloco, index) => (
          <article
            key={bloco.titulo}
            data-holofote
            className={cn(
              "bloco-revelado holofote group relative isolate overflow-hidden p-7 md:p-9",
              escuro ? "bg-neutral-950" : "bg-white holofote--claro",
            )}
          >
            {numerado && (
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -right-3 -top-6 select-none [font-family:var(--font-bricolage)] text-[7rem] font-extrabold leading-none tracking-[-0.06em] transition-[transform,opacity] duration-700 ease-out group-hover:-translate-y-1 group-hover:opacity-100",
                  escuro
                    ? "text-white/[0.045] opacity-70"
                    : "text-black/[0.045] opacity-70",
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            )}

            <span
              aria-hidden="true"
              className={cn(
                "cantoneira absolute inset-0",
                escuro ? "text-white" : "text-black",
              )}
            />

            <div className="relative">
              {numerado && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "[font-family:var(--font-geist-mono)] text-[11px] tabular-nums",
                    escuro ? "text-white/35" : "text-black/30",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
              <h3
                className={cn(
                  "mt-5 [font-family:var(--font-bricolage)] text-xl font-semibold leading-snug tracking-tight md:text-[1.4rem]",
                  escuro ? "text-white" : "text-black",
                )}
              >
                {bloco.titulo}
              </h3>
              <p
                className={cn(
                  "mt-3.5 text-sm leading-relaxed",
                  escuro ? "text-white/55" : "text-black/55",
                )}
              >
                {bloco.texto}
              </p>
            </div>

            {/* Grows from the left on hover. `scaleX` on a full-width hairline,
                so it never participates in layout. */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-7 bottom-0 h-px origin-left scale-x-0 transition-transform duration-500 ease-out group-hover:scale-x-100 md:inset-x-9",
                escuro ? "bg-white/45" : "bg-black/35",
              )}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
