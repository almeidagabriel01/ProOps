"use client";

import React, { useState } from "react";
import Link from "next/link";
import { m as motion } from "motion/react";

import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { cn } from "@/lib/utils";

import type { Canal } from "@/app/institucional/_content/institucional-copy";

/**
 * Pick a reason, get a destination.
 *
 * The interactive piece of the company site, and it holds no text input on
 * purpose. A second contact form would either duplicate the ERP's pipeline or
 * drop messages into an unwatched inbox; routing is the thing this page can do
 * that the form cannot.
 *
 * Built as a real radio group. Buttons with `aria-pressed` would announce as
 * four independent toggles, and a keyboard user would have to tab through all of
 * them; a radiogroup is one tab stop with arrow keys inside it, which is what a
 * "choose one" control is supposed to be. Roving `tabIndex` is what makes that
 * work, and `onKeyDown` moves the selection so the arrows do something.
 *
 * The panel is a single element whose content swaps, keyed by the selection, so
 * the height animates instead of jumping. `layout` on the container is what
 * measures that: four reasons produce four different paragraph heights, and
 * without it the page below would jolt on every click.
 */
export function SeletorDeCanal({ canais }: { canais: Canal[] }) {
  const [ativo, setAtivo] = useState(0);
  const canal = canais[ativo];

  const mover = (delta: number) => {
    setAtivo((i) => (i + delta + canais.length) % canais.length);
  };

  return (
    <div className="grid gap-px bg-white/10 md:grid-cols-[1fr_1.15fr]">
      <div
        role="radiogroup"
        aria-label="Motivo do contato"
        className="bg-neutral-950 p-3 md:p-5"
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            mover(1);
          }
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            mover(-1);
          }
        }}
      >
        {canais.map((item, index) => {
          const selecionado = index === ativo;
          return (
            <button
              key={item.motivo}
              type="button"
              role="radio"
              aria-checked={selecionado}
              // Roving tabindex: the group is ONE tab stop, and the arrows move
              // inside it. Without this every option is its own stop, which is
              // exactly the thing a radio group exists to avoid.
              tabIndex={selecionado ? 0 : -1}
              onClick={() => setAtivo(index)}
              className={cn(
                "group relative flex w-full items-center gap-4 px-5 py-6 text-left transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 md:px-6",
                selecionado
                  ? "text-white"
                  : "text-white/50 hover:text-white/80",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                  selecionado
                    ? "border-white"
                    : "border-white/25 group-hover:border-white/50",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full bg-white transition-transform duration-300",
                    selecionado ? "scale-100" : "scale-0",
                  )}
                />
              </span>
              <span className="[font-family:var(--font-bricolage)] text-lg font-semibold tracking-tight md:text-xl">
                {item.motivo}
              </span>
            </button>
          );
        })}
      </div>

      <motion.div layout className="bg-neutral-950 p-8 md:p-12">
        {/*
          `key` on the inner block, not on the wrapper: remounting the wrapper
          would remount the `layout` element too and it would have no previous
          height to animate from, so the panel would jump exactly as it did
          without the animation.
        */}
        <motion.div
          key={canal.motivo}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] text-white/45">
            {canal.titulo}
          </p>
          <p className="mt-6 [font-family:var(--font-bricolage)] text-2xl font-semibold leading-snug tracking-tight text-white md:text-3xl">
            {canal.texto}
          </p>
          <div className="mt-10">
            <Magnetic>
              {canal.externo ? (
                <a
                  href={canal.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 border-b border-white/30 pb-1.5 text-base text-white transition-colors hover:border-white"
                >
                  {canal.acao}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                  >
                    &rarr;
                  </span>
                </a>
              ) : (
                <Link
                  href={canal.href}
                  className="group inline-flex items-center gap-2 border-b border-white/30 pb-1.5 text-base text-white transition-colors hover:border-white"
                >
                  {canal.acao}
                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                  >
                    &rarr;
                  </span>
                </Link>
              )}
            </Magnetic>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
