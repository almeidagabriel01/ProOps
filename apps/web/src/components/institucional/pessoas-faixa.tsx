"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { m as motion, useTransform } from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { cn } from "@/lib/utils";

import type { Pessoa } from "@/app/institucional/_content/institucional-copy";

/**
 * Who does the work, with their faces.
 *
 * The single most important block on a company site, because it is the answer to
 * "who am I buying from", and the one section here whose content is confirmed
 * rather than draft.
 *
 * The portraits are duotone by default and resolve to full colour on hover: the
 * page is monochrome, and three photographs at full saturation are the only
 * colour on it, which reads as a mistake until you point at them. `grayscale` on
 * the image plus a `mix-blend` tint on top is what keeps them part of the design
 * while the person is still recognisable, and the hover is what says they are
 * real people rather than stock.
 */
export function PessoasFaixa({
  pessoas,
  tom = "escuro",
  className,
}: {
  pessoas: Pessoa[];
  tom?: "escuro" | "claro";
  className?: string;
}) {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, {
    start: "top 90%",
    end: "bottom 65%",
    fallback: 1,
  });

  return (
    <div
      ref={trilha}
      className={cn(
        "grid gap-px sm:grid-cols-2 lg:grid-cols-3",
        tom === "escuro" ? "bg-white/10" : "bg-black/10",
        className,
      )}
    >
      {pessoas.map((pessoa, index) => (
        <Cartao
          key={pessoa.nome}
          pessoa={pessoa}
          indice={index}
          total={pessoas.length}
          progresso={progress}
          animado={animated}
          tom={tom}
        />
      ))}
    </div>
  );
}

function Cartao({
  pessoa,
  indice,
  total,
  progresso,
  animado,
  tom,
}: {
  pessoa: Pessoa;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
  tom: "escuro" | "claro";
}) {
  const fatia = 0.5 / total;
  const de = 0.05 + indice * fatia;
  const ate = de + fatia * 2.4;

  const y = useTransform(progresso, [de, ate], [34, 0]);
  const opacity = useTransform(progresso, [de, ate], [0, 1]);

  const escuro = tom === "escuro";

  return (
    <motion.article
      style={animado ? { y, opacity } : undefined}
      className={cn(
        "group relative overflow-hidden p-6 md:p-7",
        escuro ? "bg-neutral-950" : "bg-white",
      )}
    >
      {/*
        `sizes` is not decoration: without it Next serves the largest candidate to
        every viewport, and three portraits at full width is most of this page's
        payload on a phone. The three breakpoints mirror the grid above.
      */}
      <div
        className={cn(
          "relative aspect-[4/5] w-full overflow-hidden border",
          escuro ? "border-white/12" : "border-black/10",
        )}
      >
        <Image
          src={pessoa.foto}
          alt={`Retrato de ${pessoa.nome}`}
          fill
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 88vw"
          className="object-cover grayscale transition-[filter,transform] duration-700 ease-out group-hover:scale-[1.03] group-hover:grayscale-0"
        />

        {/* The duotone. `mix-blend-*` over a greyscale image tints it without a
            second asset, and it lifts on hover along with the saturation. */}
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-700",
            escuro
              ? "bg-neutral-950/45 mix-blend-color group-hover:opacity-0"
              : "bg-white/35 mix-blend-lighten group-hover:opacity-0",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-700 group-hover:opacity-40",
            escuro
              ? "bg-gradient-to-t from-neutral-950 via-neutral-950/10 to-transparent"
              : "bg-gradient-to-t from-white via-white/10 to-transparent",
          )}
        />

        {/* Sits ON the portrait, over the gradient, so the name reads as a label
            on a photograph rather than as a caption under a box. */}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p
            className={cn(
              "[font-family:var(--font-bricolage)] text-lg font-semibold leading-tight tracking-tight md:text-xl",
              escuro ? "text-white" : "text-black",
            )}
          >
            {pessoa.nome}
          </p>
          <p
            className={cn(
              "mt-1.5 [font-family:var(--font-geist-mono)] text-[10px] uppercase leading-relaxed tracking-[0.16em]",
              escuro ? "text-white/55" : "text-black/50",
            )}
          >
            {pessoa.papel}
          </p>
        </div>
      </div>

      {pessoa.formacao && (
        <p
          className={cn(
            "mt-5 inline-flex items-center gap-2 [font-family:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.14em]",
            escuro ? "text-white/40" : "text-black/40",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-px w-4",
              escuro ? "bg-white/30" : "bg-black/25",
            )}
          />
          {pessoa.formacao}
        </p>
      )}

      <p
        className={cn(
          "mt-4 text-sm leading-relaxed",
          escuro ? "text-white/60" : "text-black/60",
        )}
      >
        {pessoa.fala}
      </p>
    </motion.article>
  );
}
