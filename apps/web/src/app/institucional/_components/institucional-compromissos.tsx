"use client";

import React, { useRef } from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import { Realce, Sobrancelha } from "@/components/institucional/secao";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { cn } from "@/lib/utils";

import { COMPROMISSOS } from "../_content/institucional-copy";

/** The beats occupy the middle, leaving room to enter and to leave. */
const INICIO = 0.14;
const FIM = 0.86;

function Beat({
  titulo,
  texto,
  indice,
  total,
  progresso,
  animado,
}: {
  titulo: string;
  texto: string;
  indice: number;
  total: number;
  progresso: MotionValue<number>;
  animado: boolean;
}) {
  const fatia = (FIM - INICIO) / total;
  const de = INICIO + indice * fatia;
  const ate = de + fatia;
  const meio = fatia * 0.22;
  const primeiro = indice === 0;
  const ultimo = indice === total - 1;

  /**
   * Each beat fades up, holds for its slice, and fades down, so only one is lit
   * at a time and the ramps overlap at the edges rather than leaving a gap.
   *
   * The first and the last are exceptions, and both for the same reason: a
   * sticky stage occupies the viewport BEFORE its trigger reaches 0 and AFTER it
   * reaches 1, because it enters and leaves by riding with its container for its
   * own height. A first beat that faded in on schedule left a screen of empty
   * stage on the way in; a last beat that faded out on schedule left one on the
   * way out. So the first is already there when the stage arrives, and the last
   * is still there when it leaves; their own slide does the entering and the
   * leaving.
   */
  /*
   * The stops are assembled explicitly rather than spread from two halves. The
   * clever version produced `[0, 1, ate - meio, ate + meio]` for the first beat,
   * which is NOT ascending, and `useTransform` requires an ascending input: it
   * would have silently mapped the whole scene to nonsense.
   */
  /*
   * The handoff is SEQUENTIAL, not a cross-fade. Fading one out and the next in
   * over the same window put both at half opacity in the middle, and since they
   * occupy the same box the two headlines were legible on top of each other. So
   * the outgoing beat finishes leaving at `ate`, and the incoming one starts
   * arriving at `ate`, which is the same instant.
   */
  const entrada = primeiro ? [0] : [de, de + meio];
  const opacidadeEntrada = primeiro ? [1] : [0, 1];
  const yEntrada = primeiro ? [0] : [34, 0];

  const saida = ultimo ? [1] : [ate - meio, ate];
  const opacidadeSaida = ultimo ? [1] : [1, 0];
  const ySaida = ultimo ? [0] : [0, -34];

  const opacity = useTransform(
    progresso,
    [...entrada, ...saida],
    [...opacidadeEntrada, ...opacidadeSaida],
  );
  const y = useTransform(
    progresso,
    [...entrada, ...saida],
    [...yEntrada, ...ySaida],
  );

  return (
    <motion.div
      style={
        animado
          ? { opacity, y }
          : // Reduced motion gets the list, stacked and all visible. Absolute
            // positioning would pile the four on top of each other, so the
            // static path un-stacks them.
            undefined
      }
      className={cn(
        "w-full max-w-3xl",
        animado ? "absolute inset-x-0" : "relative mb-14 last:mb-0",
      )}
    >
      <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.26em] tabular-nums text-white/40">
        {String(indice + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <h3 className="mt-6 [font-family:var(--font-bricolage)] text-[clamp(2rem,5.6vw,3.8rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
        {titulo}
      </h3>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg">
        {texto}
      </p>
    </motion.div>
  );
}

/**
 * What the company promises to do with the data it is handed.
 *
 * The last argument before the closing, and the one a prospect actually needs:
 * a company page can talk about craft for ten screens, and the question still
 * standing is whether their client list is safe here.
 *
 * Four beats through one stage rather than four cards side by side. A grid of
 * four commitments is skimmed and forgotten; one at a time, each holding the
 * screen for its own stretch of scroll, is read.
 *
 * The measure of the whole section is drawn as a rule along the bottom, in four
 * segments, so the reader can see how many are left. Without it a stage that
 * keeps replacing its own content reads as a page that stopped scrolling.
 */
export function InstitucionalCompromissos() {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, { fallback: 1 });

  return (
    <section
      ref={trilha}
      aria-label="Compromissos da ProOps"
      className="relative border-t border-white/10 bg-neutral-950 text-white"
      // One screen of scroll per beat, plus one for entering and leaving.
      style={animated ? { height: `${(COMPROMISSOS.length + 1) * 100}vh` } : undefined}
    >
      <div
        className={cn(
          "px-6 md:px-10",
          animated
            ? "sticky top-0 flex h-[100svh] items-center overflow-hidden"
            : "py-24 md:py-32",
        )}
      >
        <div
          aria-hidden="true"
          className="grade-pontos pointer-events-none absolute inset-0 opacity-40"
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl">
          <Sobrancelha className="mb-12 md:mb-16">
            O que a gente garante
          </Sobrancelha>

          {/* The stage. Its height is reserved by the tallest beat so the four
              can be absolutely positioned without the section collapsing; under
              reduced motion they are in flow and this is just a wrapper. */}
          <div
            className={cn(
              "relative",
              animated && "min-h-[22rem] md:min-h-[24rem]",
            )}
          >
            {COMPROMISSOS.map((compromisso, index) => (
              <Beat
                key={compromisso.titulo}
                titulo={compromisso.titulo}
                texto={compromisso.texto}
                indice={index}
                total={COMPROMISSOS.length}
                progresso={progress}
                animado={animated}
              />
            ))}
          </div>

          {/* Inside the stage, under the deck. Outside it, the line would only
              be reached after the stage had already slid away, which is exactly
              the screen of nothing this scene is built to avoid. */}
          <Fecho progresso={progress} animado={animated} />
        </div>

        {animated && (
          <div
            aria-hidden="true"
            className="absolute inset-x-6 bottom-12 flex gap-2 md:inset-x-10"
          >
            {COMPROMISSOS.map((compromisso, index) => (
              <Segmento
                key={compromisso.titulo}
                indice={index}
                total={COMPROMISSOS.length}
                progresso={progress}
              />
            ))}
          </div>
        )}
      </div>

    </section>
  );
}

function Segmento({
  indice,
  total,
  progresso,
}: {
  indice: number;
  total: number;
  progresso: MotionValue<number>;
}) {
  const fatia = (FIM - INICIO) / total;
  const de = INICIO + indice * fatia;
  const escala = useTransform(progresso, [de, de + fatia], [0, 1]);

  return (
    <div className="h-px flex-1 bg-white/12">
      <motion.div
        style={{ scaleX: escala }}
        className="h-px w-full origin-left bg-white/70"
      />
    </div>
  );
}

function Fecho({
  progresso,
  animado,
}: {
  progresso: MotionValue<number>;
  animado: boolean;
}) {
  const opacity = useTransform(progresso, [FIM - 0.06, FIM + 0.02], [0, 1]);

  return (
    <motion.p
      style={animado ? { opacity } : undefined}
      className={cn(
        "mt-14 max-w-2xl text-base leading-relaxed text-white/50 md:mt-16 md:text-lg",
      )}
    >
      Nada disso é <Realce>diferencial</Realce>. É o mínimo para alguém confiar o
      dado da própria empresa a um sistema.
    </motion.p>
  );
}
