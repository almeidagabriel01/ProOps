"use client";

import React, { useRef } from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";

import { FRASE_MANIFESTO } from "../_content/institucional-copy";

/** The reveal occupies the middle of the travel, leaving room to enter and exit. */
const INICIO = 0.12;
const FIM = 0.82;
/** How dim an un-reached word is. Low enough to read as unlit, high enough to read. */
const APAGADO = 0.16;

function Palavra({
  palavra,
  indice,
  total,
  progresso,
  animado,
}: {
  palavra: string;
  indice: number;
  total: number;
  progresso: MotionValue<number>;
  animado: boolean;
}) {
  // Each word owns a slice of the travel and overlaps the next one slightly, so
  // the lit edge moves as a soft front instead of snapping word by word.
  const span = (FIM - INICIO) / total;
  const de = INICIO + indice * span;
  const ate = de + span * 1.8;

  const opacity = useTransform(progresso, [de, ate], [APAGADO, 1]);
  // A touch of blur on the unlit words. It is what makes the lit front read as
  // focus rather than as a brightness ramp, and it is the effect the scene is
  // named after.
  const filter = useTransform(
    progresso,
    [de, ate],
    ["blur(3px)", "blur(0px)"],
  );

  return (
    <motion.span
      style={animado ? { opacity, filter } : undefined}
      className="inline-block will-change-[opacity,filter]"
    >
      {palavra}
      {/* A real space, outside the animated span, so the words do not run
          together when each one is inline-block. */}
      {" "}
    </motion.span>
  );
}

/**
 * One sentence, brought into focus as the reader scrolls through it.
 *
 * The first moment on the page where scrolling is doing something other than
 * moving the page, and it is deliberately the simplest one: a sentence the
 * company would say out loud, arriving at the speed someone reads it.
 *
 * Built on a tall section with a `sticky` stage rather than on a ScrollTrigger
 * `pin`. A pin inserts a spacer element and rewrites the document height, which
 * is fine for one scene and a liability for a page with several: the spacers
 * have to be re-measured on every refresh, and a nested ScrollTrigger inside a
 * pinned parent measures against the spacer rather than the viewport. Sticky
 * costs nothing, never touches the document height, and is what `landing-niches`
 * and `landing-security` both settled on.
 *
 * The words are in the markup as words, split in JSX, with no `SplitText` here:
 * the reveal needs each word tied to the SECTION's progress, and SplitText
 * rewrites the DOM at a moment that would race the sticky stage's first
 * measurement.
 *
 * Under `prefers-reduced-motion`, `useScrollProgress` holds the progress at 1
 * and `animado` is false, so every word renders lit and unblurred: the sentence
 * is simply there.
 */
export function InstitucionalFrase() {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, { fallback: 1 });

  const palavras = FRASE_MANIFESTO.split(" ");
  const opacidadeDica = useTransform(progress, [0, 0.08], [1, 0]);
  const regua = useTransform(progress, [INICIO, FIM], [0, 1]);

  /**
   * The exit: the sentence recedes, it does not vanish.
   *
   * The distinction is load-bearing, and the first version got it wrong. A
   * sticky stage keeps holding the viewport AFTER its trigger reaches progress
   * 1: from that point the stage rides up with its container for its own height,
   * which is one whole screen of scrolling. Fading the sentence to zero by
   * progress 1 therefore left a full screen of black between this scene and the
   * next, with the stage still on and nothing on it.
   *
   * So the ramp ends at 0.35, not at 0, and the stage's own slide is what
   * actually takes the sentence off screen. It starts after the last word is
   * lit, so nobody loses a word they are still reading.
   */
  const saidaOpacidade = useTransform(progress, [0.86, 1], [1, 0.35]);
  const saidaEscala = useTransform(progress, [0.86, 1], [1, 0.94]);
  const saidaY = useTransform(progress, [0.86, 1], ["0%", "-4%"]);

  return (
    <section
      ref={trilha}
      aria-label="O que a ProOps faz"
      // 240vh gives the sentence about a screen and a half of reading time. Less
      // and the front outruns the reader; more and it feels like the page stuck.
      className="relative border-t border-white/10 bg-neutral-950 text-white"
      style={{ height: "240vh" }}
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden px-6 md:px-10">
        <div
          aria-hidden="true"
          className="grade-pontos pointer-events-none absolute inset-0 opacity-40"
        />

        <motion.p
          style={
            animated
              ? {
                  opacity: saidaOpacidade,
                  scale: saidaEscala,
                  y: saidaY,
                }
              : undefined
          }
          className="relative z-10 mx-auto max-w-5xl [font-family:var(--font-bricolage)] text-[clamp(1.6rem,4.6vw,3.4rem)] font-semibold leading-[1.22] tracking-[-0.025em]"
        >
          {palavras.map((palavra, index) => (
            <Palavra
              key={`${palavra}-${index}`}
              palavra={palavra}
              indice={index}
              total={palavras.length}
              progresso={progress}
              animado={animated}
            />
          ))}
        </motion.p>

        {/* The travel, as a hairline. It is the only affordance telling the
            reader that the section has a length, which a sticky stage otherwise
            hides. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-6 bottom-12 h-px bg-white/10 md:inset-x-10"
        >
          <motion.div
            style={animated ? { scaleX: regua } : { scaleX: 1 }}
            className="h-px w-full origin-left bg-white/70"
          />
        </div>

        <motion.span
          aria-hidden="true"
          style={animated ? { opacity: opacidadeDica } : { opacity: 0 }}
          className="absolute inset-x-0 bottom-20 text-center [font-family:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.3em] text-white/35"
        >
          Role para ler
        </motion.span>
      </div>
    </section>
  );
}
