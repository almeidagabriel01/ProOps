"use client";

import React, { useRef } from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import {
  DiagramaContinuidade,
  DiagramaGente,
  DiagramaIsolamento,
  DiagramaLgpd,
} from "@/components/institucional/diagramas";
import { Realce, Sobrancelha } from "@/components/institucional/secao";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { cn } from "@/lib/utils";

import { COMPROMISSOS } from "../_content/institucional-copy";

/** The beats occupy the middle, leaving room to enter and to leave. */
const INICIO = 0.14;
const FIM = 0.86;

/**
 * One drawing per commitment, matched to `COMPROMISSOS` by index.
 *
 * By index and not by key on purpose: the copy lives in `_content`, and a
 * `diagrama` field there would force a text module to import React components.
 */
const DIAGRAMAS = [
  DiagramaIsolamento,
  DiagramaLgpd,
  DiagramaGente,
  DiagramaContinuidade,
];

/** Where a beat's slice of the travel starts and ends. */
function fatiaDe(indice: number, total: number) {
  const largura = (FIM - INICIO) / total;
  const de = INICIO + indice * largura;
  return { de, ate: de + largura, meio: largura * 0.22 };
}

/**
 * The ramps for one beat, entering and leaving.
 *
 * The first and the last are exceptions, and both for the same reason: a sticky
 * stage occupies the viewport BEFORE its trigger reaches 0 and AFTER it reaches
 * 1, because it enters and leaves by riding with its container for its own
 * height. A first beat that faded in on schedule left a screen of empty stage on
 * the way in; a last beat that faded out on schedule left one on the way out. So
 * the first is already there when the stage arrives, and the last is still there
 * when it leaves.
 *
 * The handoff between beats is SEQUENTIAL, not a cross-fade: fading one out and
 * the next in over the same window put both at half opacity in the middle, and
 * since they share a box the two headlines were legible on top of each other.
 */
function rampasDe(indice: number, total: number) {
  const { de, ate, meio } = fatiaDe(indice, total);
  const primeiro = indice === 0;
  const ultimo = indice === total - 1;

  const entrada = primeiro ? [0] : [de, de + meio];
  const saida = ultimo ? [1] : [ate - meio, ate];

  return {
    paradas: [...entrada, ...saida],
    opacidade: [
      ...(primeiro ? [1] : [0, 1]),
      ...(ultimo ? [1] : [1, 0]),
    ],
    y: [...(primeiro ? [0] : [34, 0]), ...(ultimo ? [0] : [0, -34])],
    escala: [
      ...(primeiro ? [1] : [0.9, 1]),
      ...(ultimo ? [1] : [1, 1.06]),
    ],
  };
}

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
  const { paradas, opacidade, y } = rampasDe(indice, total);
  const opacity = useTransform(progresso, paradas, opacidade);
  const deslocamento = useTransform(progresso, paradas, y);

  return (
    <motion.div
      style={animado ? { opacity, y: deslocamento } : undefined}
      className={cn(
        "w-full max-w-xl",
        // Reduced motion gets the list, stacked and all visible. Absolute
        // positioning would pile the four on top of each other.
        animado ? "absolute inset-x-0" : "relative mb-14 last:mb-0",
      )}
    >
      <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.26em] tabular-nums text-white/40">
        {String(indice + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>
      <h3 className="mt-6 [font-family:var(--font-bricolage)] text-[clamp(1.9rem,4.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
        {titulo}
      </h3>
      <p className="mt-6 text-base leading-relaxed text-white/60 md:text-lg">
        {texto}
      </p>

      {/* On a phone the drawing rides with its own beat, under the copy: there
          is no second column to put it in, and a diagram that only exists on
          desktop makes the small screen the lesser version of the page. */}
      {DIAGRAMAS[indice] && (
        <div className="mt-10 h-24 w-24 text-white/65 md:hidden">
          {React.createElement(DIAGRAMAS[indice])}
        </div>
      )}
    </motion.div>
  );
}

/**
 * The drawing column, desktop only.
 *
 * A single stage where the diagrams swap, not one per beat stacked: the frame
 * staying put is what makes the swap read as the same subject being examined
 * from four angles rather than as four unrelated pictures scrolling by.
 */
function Desenho({
  indice,
  total,
  progresso,
}: {
  indice: number;
  total: number;
  progresso: MotionValue<number>;
}) {
  const { paradas, opacidade, escala } = rampasDe(indice, total);
  const opacity = useTransform(progresso, paradas, opacidade);
  const scale = useTransform(progresso, paradas, escala);
  const Diagrama = DIAGRAMAS[indice];
  if (!Diagrama) return null;

  return (
    <motion.div
      style={{ opacity, scale }}
      className="absolute inset-0 grid place-items-center text-white/70"
    >
      <Diagrama className="h-full w-full" />
    </motion.div>
  );
}

/**
 * What the company promises to do with the data it is handed.
 *
 * The last argument before the closing, and the one a prospect actually needs: a
 * company page can talk about craft for ten screens, and the question still
 * standing is whether their client list is safe here.
 *
 * Four beats through one stage rather than four cards side by side. A grid of
 * four commitments is skimmed and forgotten; one at a time, each holding the
 * screen for its own stretch of scroll, is read.
 *
 * The right half is a drawing that changes with the beat. It is not decoration:
 * the first version of this scene was four sentences alone on a screen, with the
 * bottom third empty, and a full viewport carrying one paragraph reads as a page
 * that ran out of things to say. The drawings also do the arguing, which is what
 * an icon would not have done.
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
      style={
        animated
          ? { height: `${(COMPROMISSOS.length + 1) * 100}vh` }
          : undefined
      }
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
          <Sobrancelha className="mb-10 md:mb-14">
            O que a gente garante
          </Sobrancelha>

          <div className="grid items-center gap-12 md:grid-cols-[1.15fr_0.85fr] md:gap-16">
            {/* The stage. Its height is reserved by the tallest beat so the four
                can be absolutely positioned without the section collapsing;
                under reduced motion they are in flow and this is a wrapper. */}
            <div
              className={cn(
                "relative",
                animated && "min-h-[20rem] md:min-h-[21rem]",
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

            {animated && (
              <div className="relative mx-auto hidden aspect-square w-full max-w-[19rem] md:block">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 border border-white/10"
                />
                <div className="absolute inset-[14%]">
                  {COMPROMISSOS.map((compromisso, index) => (
                    <Desenho
                      key={compromisso.titulo}
                      indice={index}
                      total={COMPROMISSOS.length}
                      progresso={progress}
                    />
                  ))}
                </div>
                {/* Corner ticks on the frame. They make the square read as a
                    viewport onto the drawing rather than as a border round it. */}
                {[
                  "left-0 top-0 border-l border-t",
                  "right-0 top-0 border-r border-t",
                  "bottom-0 left-0 border-b border-l",
                  "bottom-0 right-0 border-b border-r",
                ].map((canto) => (
                  <span
                    key={canto}
                    aria-hidden="true"
                    className={cn("absolute h-4 w-4 border-white/45", canto)}
                  />
                ))}
              </div>
            )}
          </div>

          <Fecho progresso={progress} animado={animated} />
        </div>

        {animated && (
          <div
            aria-hidden="true"
            className="absolute inset-x-6 bottom-10 flex gap-2 md:inset-x-10"
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
  const { de, ate } = fatiaDe(indice, total);
  const escala = useTransform(progresso, [de, ate], [0, 1]);

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
      className="mt-12 max-w-2xl text-base leading-relaxed text-white/45 md:mt-14 md:text-lg"
    >
      Nada disso é <Realce>diferencial</Realce>. É o mínimo para alguém confiar o
      dado da própria empresa a um sistema.
    </motion.p>
  );
}
