"use client";

import React, { useRef } from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import { Sobrancelha } from "@/components/institucional/secao";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";

import { PLANILHAS } from "../_content/institucional-copy";

/**
 * Where each sheet starts, and how it is tilted.
 *
 * Viewport units, NOT percentages. A percentage in a `transform: translate` is
 * measured against the ELEMENT's own box, not its parent, so `-62%` moved a
 * 240px card by 149px and all six landed in a heap in the middle of the stage,
 * which is the opposite of scattered. Viewport units measure against the
 * viewport, which is what "off to the side" means here.
 *
 * Safe against the horizontal-overflow guard because the sticky stage is
 * `overflow-hidden`: a card starting past the edge is clipped, and a clipped
 * transform contributes nothing to `document.scrollWidth`. That is the exact
 * failure the mobile spec watches for at 393px, and clipping is what prevents it.
 */
const DISPERSAO = [
  { x: -34, y: -26, rot: -13, escala: 0.86 },
  { x: 30, y: -30, rot: 10, escala: 0.92 },
  { x: -40, y: 16, rot: 7, escala: 0.9 },
  { x: 38, y: 22, rot: -8, escala: 0.84 },
  { x: -14, y: 34, rot: 15, escala: 0.95 },
  { x: 18, y: -6, rot: -5, escala: 0.88 },
] as const;

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

  const x = useTransform(progresso, [de, ate], [`${cfg.x}vw`, "0vw"]);
  const y = useTransform(progresso, [de, ate], [`${cfg.y}vh`, "0vh"]);
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
      className="absolute w-[min(17rem,66vw)] overflow-hidden border border-white/25 bg-neutral-900 shadow-[0_24px_60px_-24px_rgba(0,0,0,1)]"
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
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden px-6 md:px-10">
        <div
          aria-hidden="true"
          className="grade-pontos pointer-events-none absolute inset-0 opacity-40"
        />

        <Sobrancelha className="relative z-10 mb-10 md:mb-14">
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
