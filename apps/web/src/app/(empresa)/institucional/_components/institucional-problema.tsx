"use client";

import React, { useRef } from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import { Sobrancelha } from "@/components/institucional/secao";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";

import { PLANILHAS } from "../_content/institucional-copy";

/**
 * Where each sheet starts, and how it is tilted.
 *
 * `x` and `y` are NORMALISED, from -1 to 1, and the stage turns them into
 * distance through two extents it declares as CSS variables (`--ex`, and
 * `--ey-cima` / `--ey-baixo`). They used to be written straight in viewport
 * units (`-40vw`, `-30vh`), which was right on a monitor and wrong on a phone:
 * a card is 66vw wide there, so 40vw off centre put most of it past the edge,
 * and 30vh up put it over the section's own eyebrow, which vanished under the
 * pile. Nobody reads "scattered" from a card that is two thirds off-screen.
 *
 * The extents are what adapts, not the numbers:
 *   - horizontal: the room that is actually left beside a card, so it touches
 *     the edge at most, at every width, from 360px to an ultrawide
 *   - vertical, portrait: the arena plus the gap around it, so the cards never
 *     climb over the eyebrow (they may go further DOWN, because the closing
 *     line underneath is still invisible while they are scattered)
 *   - vertical, landscape: the original 34vh, which is what the desktop was
 *     designed with and where the width keeps them off the eyebrow
 *
 * Viewport units and not percentages, still: a percentage in a translate is
 * measured against the element's own box, and all six would land in a heap.
 */
const DISPERSAO = [
  { x: -0.85, y: -0.76, rot: -13, escala: 0.86 },
  { x: 0.75, y: -0.88, rot: 10, escala: 0.92 },
  { x: -1, y: 0.47, rot: 7, escala: 0.9 },
  { x: 0.95, y: 0.65, rot: -8, escala: 0.84 },
  { x: -0.35, y: 1, rot: 15, escala: 0.95 },
  { x: 0.45, y: -0.18, rot: -5, escala: 0.88 },
] as const;

/**
 * Where a card is, `k` of the way back from its scattered start (1 = scattered,
 * 0 = landed). Returned as a `calc()` over the stage's extents, so the SAME
 * motion value lands correctly at any width without a resize listener.
 */
function deslocamento(normal: number, k: number, extensao: string): string {
  return `calc(var(${extensao}) * ${(Math.abs(normal) * k).toFixed(4)} * ${
    normal < 0 ? -1 : 1
  })`;
}

const REUNE_ATE = 0.62;

/**
 * Larguras das barras de cada linha falsa, em porcentagem.
 *
 * Fixas e não aleatórias: `Math.random()` aqui daria seis cards com formas
 * diferentes a cada render, e uma diferença entre servidor e cliente que o React
 * reclamaria na hidratação.
 */
const LINHAS_FALSAS = [
  [34, 22, 14],
  [26, 30, 16],
  [40, 16, 18],
  [22, 26, 12],
];

function Planilha({
  nome,
  indice,
  progresso,
  animado,
}: {
  nome: string;
  indice: number;
  progresso: MotionValue<number>;
  animado: boolean;
}) {
  const cfg = DISPERSAO[indice % DISPERSAO.length];
  // Each sheet arrives slightly after the one before it, so the pile assembles
  // instead of collapsing in one frame.
  const de = 0.06 + indice * 0.035;
  const ate = REUNE_ATE;

  const restante = useTransform(progresso, [de, ate], [1, 0]);
  const x = useTransform(restante, (k) => deslocamento(cfg.x, k, "--ex"));
  const y = useTransform(restante, (k) =>
    deslocamento(cfg.y, k, cfg.y < 0 ? "--ey-cima" : "--ey-baixo"),
  );
  const rotate = useTransform(progresso, [de, ate], [cfg.rot, 0]);
  const scale = useTransform(progresso, [de, ate], [cfg.escala, 1]);
  // They fade as they land: six stacked cards at full opacity is a smear, and
  // what should remain legible is the one underneath them.
  const opacity = useTransform(
    progresso,
    [de, ate * 0.8, ate],
    [1, 0.85, 0.12],
  );

  return (
    <motion.div
      style={
        animado
          ? { x, y, rotate, scale, opacity, zIndex: DISPERSAO.length - indice }
          : { opacity: 0.12 }
      }
      className="absolute w-[var(--largura-planilha)] overflow-hidden border border-white/25 bg-neutral-900 shadow-[0_24px_60px_-24px_rgba(0,0,0,1)]"
    >
      {/* Title bar: the file name, and a column letter, which is the one detail
          that says "spreadsheet" without a single icon. */}
      <div className="flex items-center gap-2.5 border-b border-white/12 px-3.5 py-2.5">
        <span
          aria-hidden="true"
          className="grid h-5 w-5 shrink-0 place-items-center border border-white/25 [font-family:var(--font-geist-mono)] text-[9px] text-white/55"
        >
          {String(indice + 1).padStart(2, "0")}
        </span>
        <span className="truncate [font-family:var(--font-geist-mono)] text-[11px] text-white/80">
          {nome}
        </span>
      </div>

      {/*
        Four rows of nothing. They are `aria-hidden` bars and not text on
        purpose: what has to read at a glance is "a grid of numbers", and real
        words there would invite the reader to squint at content that does not
        exist. The widths are fixed per row rather than random so the six cards
        do not flicker into different shapes on a re-render.
      */}
      <div aria-hidden="true" className="space-y-px bg-white/[0.06] p-px">
        {LINHAS_FALSAS.map((linha, i) => (
          <div
            key={i}
            className="flex items-center gap-px bg-neutral-900 px-3.5 py-[7px]"
          >
            {linha.map((largura, j) => (
              <span
                key={j}
                style={{ width: `${largura}%` }}
                className="mr-3 block h-1.5 rounded-[1px] bg-white/15 last:mr-0"
              />
            ))}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Six spreadsheets, colliding into one base.
 *
 * The problem the company exists to solve, argued as a mechanism instead of as a
 * paragraph: the reader scrolls, the scattered files converge, dim, and what is
 * left underneath them is a single record. Nobody has to be told that the six
 * were the problem.
 *
 * The file names are the real ones a company like this has, down to
 * `_v7_FINAL`, because the recognition is the argument.
 *
 * Same sticky-stage construction as the sentence scene, for the same reason: no
 * pin spacer, no document-height rewrite, nothing to re-measure. Every card is
 * authored at its FINAL position and animated with `useTransform` off the
 * section progress, so with reduced motion the stage renders assembled, which is
 * the state that makes sense to arrive at.
 */
export function InstitucionalProblema() {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, { fallback: 1 });

  const baseOpacity = useTransform(progress, [REUNE_ATE - 0.1, 0.78], [0, 1]);
  const baseScale = useTransform(progress, [REUNE_ATE - 0.1, 0.78], [0.94, 1]);
  const tituloOpacity = useTransform(progress, [0.8, 0.92], [0, 1]);

  return (
    <section
      ref={trilha}
      aria-label="O problema"
      className="relative border-t border-white/10 bg-neutral-950 text-white"
      style={{ height: "300vh" }}
    >
      {/*
        The extents the cards scatter by (see DISPERSAO). `--largura-planilha`
        is declared here and not on the card because the horizontal extent is
        derived from it: the room beside a card is half the viewport minus half
        the card, minus a small margin so the tilted corner does not touch the
        edge. Capped at the 40vw the desktop was designed with.

        The top padding below `md` is the navbar's height: on a short phone the
        centred column is taller than what is left, and the eyebrow would sit
        under the fixed pill.
      */}
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-6 pt-[4.5rem] [--largura-planilha:min(17rem,56vw)] [--ex:min(40vw,calc(50vw_-_var(--largura-planilha)/2_-_0.75rem))] [--ey-cima:34vh] [--ey-baixo:34vh] portrait:[--ey-cima:calc(19vh_-_2rem)] portrait:[--ey-baixo:calc(19vh_+_4rem)] md:px-10 md:pt-0 md:[--largura-planilha:min(17rem,66vw)] md:portrait:[--ey-cima:calc(21vh_-_1rem)] md:portrait:[--ey-baixo:calc(21vh_+_4rem)]">
        <div
          aria-hidden="true"
          className="grade-pontos pointer-events-none absolute inset-0 opacity-40"
        />

        <Sobrancelha className="relative z-20 mb-10 md:mb-14">
          O problema
        </Sobrancelha>

        {/* The arena. A fixed share of the viewport height rather than an aspect
            ratio: an aspect box on a wide monitor is 500px tall and pushes the
            closing line off the fold, and the sheets converge to the CENTRE of
            this box, so its height is what decides where they land. */}
        <div className="relative z-10 grid h-[38vh] w-full max-w-3xl place-items-center md:h-[42vh]">
          {PLANILHAS.map((nome, index) => (
            <Planilha
              key={nome}
              nome={nome}
              indice={index}
              progresso={progress}
              animado={animated}
            />
          ))}

          <motion.div
            style={
              animated
                ? { opacity: baseOpacity, scale: baseScale }
                : { opacity: 1 }
            }
            className="relative z-10 w-[min(22rem,80vw)] border border-white/25 bg-neutral-950 px-6 py-7 text-center shadow-[0_40px_100px_-40px_rgba(255,255,255,0.25)]"
          >
            <p className="[font-family:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.28em] text-white/45">
              Uma base
            </p>
            <p className="mt-3 [font-family:var(--font-bricolage)] text-2xl font-semibold tracking-tight md:text-3xl">
              Proposta, cliente e dinheiro
            </p>
            <p className="mt-2 text-sm text-white/55">
              na mesma história, atualizados juntos.
            </p>
          </motion.div>
        </div>

        <motion.p
          style={animated ? { opacity: tituloOpacity } : { opacity: 1 }}
          className="relative z-10 mt-10 max-w-xl text-center text-base leading-relaxed text-white/60 md:mt-14 md:text-lg"
        >
          Toda empresa que vende projeto já teve estas seis. O trabalho não é
          preencher nenhuma delas: é manter as seis dizendo a mesma coisa.
        </motion.p>
      </div>
    </section>
  );
}
