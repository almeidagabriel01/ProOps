"use client";

import React, { useRef } from "react";
import { m as motion, useTransform } from "motion/react";

import { Realce } from "@/components/institucional/secao";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { cn } from "@/lib/utils";

import type { Principio } from "@/app/institucional/_content/institucional-copy";

/**
 * One principle, given a whole screen.
 *
 * The root experience shows the three side by side, as a grid, because there it
 * is one beat inside a longer pass. Here each gets its own sticky stage: the
 * reader chose to open the manifesto, so the page can afford to slow down and
 * argue one idea at a time.
 *
 * The numeral behind the text is the scene's motion. It counter-scrolls and
 * swells as the reader passes, which gives a screen holding only type a sense of
 * depth without adding an image, a card or a border. The side alternates, so
 * three consecutive screens are not the same screen three times, and the
 * background flips with it for the same reason.
 */
export function PrincipioCena({
  principio,
  indice,
  total,
}: {
  principio: Principio;
  indice: number;
  total: number;
}) {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, { fallback: 1 });
  const claro = indice % 2 === 1;
  const direita = indice % 2 === 1;

  const numeralY = useTransform(progress, [0, 1], ["18%", "-18%"]);
  const numeralEscala = useTransform(progress, [0, 1], [0.9, 1.15]);

  // Enter AND leave. A scene that only enters turns the page into a stack of
  // blocks; the four-stop ramp holds the copy still through the middle, which is
  // where it is being read.
  const opacity = useTransform(progress, [0, 0.22, 0.78, 1], [0, 1, 1, 0]);
  const y = useTransform(progress, [0, 0.22, 0.78, 1], [40, 0, 0, -40]);

  return (
    <section
      ref={trilha}
      aria-label={principio.titulo}
      className={cn(
        "relative border-t",
        claro
          ? "border-black/10 bg-white text-black"
          : "border-white/10 bg-neutral-950 text-white",
      )}
      style={{ height: "200vh" }}
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden px-6 md:px-10">
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 opacity-40",
            claro ? "grade-pontos grade-pontos--claro" : "grade-pontos",
          )}
        />

        {/* Texture, not content: `aria-hidden` so a screen reader does not
            announce "zero two" before the heading it belongs to. */}
        <motion.span
          aria-hidden="true"
          style={animated ? { y: numeralY, scale: numeralEscala } : undefined}
          className={cn(
            "pointer-events-none absolute select-none [font-family:var(--font-bricolage)] text-[clamp(16rem,42vw,34rem)] font-extrabold leading-none tracking-[-0.06em]",
            direita ? "right-[-4vw]" : "left-[-4vw]",
            claro ? "text-black/[0.045]" : "text-white/[0.05]",
          )}
        >
          {String(indice + 1).padStart(2, "0")}
        </motion.span>

        <motion.div
          style={animated ? { opacity, y } : undefined}
          className={cn(
            "relative z-10 mx-auto w-full max-w-6xl",
            direita && "md:text-right",
          )}
        >
          <p
            className={cn(
              "[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.26em] tabular-nums",
              claro ? "text-black/40" : "text-white/45",
            )}
          >
            {String(indice + 1).padStart(2, "0")} de{" "}
            {String(total).padStart(2, "0")}
          </p>

          <h2
            className={cn(
              "mt-7 max-w-4xl [font-family:var(--font-bricolage)] text-[clamp(2.2rem,6.4vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.035em]",
              direita && "md:ml-auto",
            )}
          >
            {principio.titulo}
          </h2>

          <p
            className={cn(
              "mt-8 max-w-2xl text-lg leading-relaxed md:text-xl",
              direita && "md:ml-auto",
              claro ? "text-black/65" : "text-white/65",
            )}
          >
            {principio.texto}
          </p>

          <p
            className={cn(
              "mt-6 max-w-2xl text-base leading-relaxed",
              direita && "md:ml-auto",
              claro ? "text-black/45" : "text-white/45",
            )}
          >
            <Realce>{principio.detalhe}</Realce>
          </p>
        </motion.div>
      </div>
    </section>
  );
}
