"use client";

import React, { useRef } from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import {
  DiagramaBase,
  DiagramaDetalhe,
  DiagramaDia,
} from "@/components/institucional/diagramas";
import { Realce, TituloSecao } from "@/components/institucional/secao";
import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { cn } from "@/lib/utils";

import { PRINCIPIOS } from "../_content/institucional-copy";

const INICIO = 0.16;
const FIM = 0.84;

/**
 * Um desenho por princípio, na ordem de `PRINCIPIOS`.
 *
 * Casado por índice e não por chave de propósito: o conteúdo mora em
 * `_content`, e acrescentar um campo `diagrama` lá obrigaria o arquivo de texto
 * a importar componente React. O `?? null` cobre um quarto princípio que entre
 * antes de alguém desenhar o quarto quadro.
 */
const DIAGRAMAS = [DiagramaDia, DiagramaBase, DiagramaDetalhe];

function Carta({
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
  const chega = INICIO + indice * fatia;
  const sai = chega + fatia;
  const primeiro = indice === 0;
  const ultimo = indice === total - 1;

  /**
   * Arrives from below, then recedes as the next one lands ON it. It never
   * leaves: the deck is the point, and the three staying visible is what turns
   * "three principles" from a claim into something the reader can see at once.
   *
   * How far back a card goes is counted from the TOP of the deck, not from its
   * own index: the oldest card has to end up highest and smallest, so the stack
   * reads as edges peeking above the current one. Counting forward put card two
   * above card one and the deck looked shuffled.
   *
   * The first and the last card are exceptions, both because a sticky stage
   * occupies the viewport before its trigger reaches 0 and after it reaches 1:
   * it enters and leaves by riding with its container for its own height. So the
   * first card is already on screen when the stage arrives, instead of leaving a
   * screen of empty deck on the way in, and the last never recedes, because
   * there is nothing behind it to recede into.
   */
  const Diagrama = DIAGRAMAS[indice] ?? null;
  const atras = total - 1 - indice;
  const yRecuado = `${-atras * 5}%`;
  const escalaRecuada = 1 - atras * 0.04;

  const entradaEm = primeiro ? 0 : chega - fatia * 0.55;
  const y = useTransform(
    progresso,
    ultimo ? [entradaEm, chega, 1] : [entradaEm, chega, sai, 1],
    ultimo
      ? [primeiro ? "0%" : "60%", "0%", "0%"]
      : [primeiro ? "0%" : "60%", "0%", yRecuado, yRecuado],
  );
  const scale = useTransform(
    progresso,
    ultimo ? [chega, 1] : [chega, sai, 1],
    ultimo ? [1, 1] : [1, escalaRecuada, escalaRecuada],
  );
  // Opacity only ever fades a card IN. A receded card stays fully opaque,
  // because a translucent one lets the card BEHIND it read straight through,
  // which is what the first version did: three headlines legible at once, on
  // top of each other. The offset and the scale are what say "further back";
  // the deck covers itself the way a real one does.
  const opacity = useTransform(
    progresso,
    [entradaEm, chega],
    [primeiro ? 1 : 0, 1],
  );

  return (
    <motion.article
      style={
        animado
          ? { y, scale, opacity, zIndex: indice }
          : // Reduced motion gets three cards in flow, all readable. Absolute
            // positioning without the transforms would pile them on each other.
            undefined
      }
      className={cn(
        // Opaque, and it has to stay that way at every point of the scrub: the
        // cards overlap almost exactly, so anything less lets the headline
        // behind read through the one in front.
        //
        // `overflow-hidden` is what CROPS the ghost numeral at the card edge.
        // Without it the numeral simply hangs outside the card, over the card
        // behind it, which reads as a layout bug and not as a device. The
        // upward shadow survives the clip: box-shadow is painted outside the
        // border box and `overflow` does not touch it.
        "relative w-full origin-top overflow-hidden border border-white/12 bg-neutral-900 p-8 shadow-[0_-20px_50px_-30px_rgba(0,0,0,0.9)] md:p-12",
        animado ? "absolute inset-x-0 top-0" : "relative mb-6 last:mb-0",
      )}
    >
      {/* O numeral gigante ao fundo, cortado pela borda do card: é o que dá
          escala à carta sem ocupar espaço de leitura. Ele é grande DE MAIS para
          a carta de propósito, e quem faz o corte é o `overflow-hidden` acima. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-5 -top-12 select-none [font-family:var(--font-bricolage)] text-[11rem] font-extrabold leading-none tracking-[-0.06em] text-white/[0.045]"
      >
        {String(indice + 1).padStart(2, "0")}
      </span>

      <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto] md:gap-12">
        <div>
          <span
            aria-hidden="true"
            className="[font-family:var(--font-geist-mono)] text-[11px] tabular-nums text-white/35"
          >
            {String(indice + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </span>
          <h3 className="mt-6 [font-family:var(--font-bricolage)] text-2xl font-semibold leading-tight tracking-tight text-white md:text-4xl">
            {titulo}
          </h3>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-white/60 md:text-lg">
            {texto}
          </p>
        </div>

        {Diagrama && (
          <div className="hidden h-32 w-32 shrink-0 text-white/70 md:block lg:h-40 lg:w-40">
            <Diagrama />
          </div>
        )}
      </div>
    </motion.article>
  );
}

/**
 * How the company works, as a deck that assembles under the reader.
 *
 * It used to be three columns in a hairline grid, which is fine and forgettable:
 * three principles side by side get skimmed as a list of adjectives. Stacking
 * them means each one holds the screen alone while it is read, and the two
 * before it stay visible underneath, so by the third the reader is looking at
 * all three at once and can see that there are only three.
 *
 * The card shows the one-line `resumo`, never the full `texto`: the argument
 * belongs to /manifesto, and this scene exists to say that there are exactly
 * three of them and then hand the reader over.
 *
 * The cards are opaque and separated by their offset alone, with a shadow cast
 * UPWARD so the current card sits visibly on top of the deck. No glass and no
 * blur: the first pass used a translucent card and the headline behind it read
 * straight through the one in front.
 */
export function InstitucionalManifesto() {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, { fallback: 1 });

  return (
    <section
      ref={trilha}
      id="como-pensamos"
      aria-label="Como a ProOps pensa"
      className="relative border-t border-white/10 bg-neutral-950 text-white"
      style={
        animated
          ? { height: `${(PRINCIPIOS.length + 1) * 100}vh` }
          : undefined
      }
    >
      <div
        className={cn(
          "px-6 md:px-10",
          animated
            ? "sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden"
            : "py-28 md:py-40",
        )}
      >
        <div
          aria-hidden="true"
          className="grade-pontos pointer-events-none absolute inset-0 opacity-40"
        />

        <div className="relative z-10 mx-auto w-full max-w-4xl">
          <TituloSecao
            sobrancelha="Como pensamos"
            titulo={
              <>
                Três coisas decidem o que <Realce>entra</Realce> no produto.
              </>
            }
            className="mb-12"
          />

          {/* The deck. Its height is reserved here so the absolutely positioned
              cards do not collapse the stage; in the static path the cards are
              in flow and this is only a wrapper. */}
          <div
            className={cn(
              "relative",
              animated && "min-h-[15rem] md:min-h-[16rem]",
            )}
          >
            {PRINCIPIOS.map((principio, index) => (
              <Carta
                key={principio.titulo}
                titulo={principio.titulo}
                texto={principio.resumo}
                indice={index}
                total={PRINCIPIOS.length}
                progresso={progress}
                animado={animated}
              />
            ))}
          </div>

          <div className="mt-12">
            <Magnetic>
              <CurtainLink
                href="/manifesto"
                className="group inline-flex items-center gap-2 border-b border-white/25 pb-1.5 text-base text-white transition-colors hover:border-white"
              >
                O manifesto inteiro
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </CurtainLink>
            </Magnetic>
          </div>
        </div>
      </div>
    </section>
  );
}
