"use client";

import React, { useRef } from "react";
import { m as motion, useTransform } from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { cn } from "@/lib/utils";

import type { Pessoa } from "@/app/institucional/_content/institucional-copy";

/**
 * Who does the work.
 *
 * There are no photographs yet, and the placeholder is not a grey rectangle
 * pretending to be one: each person is a monogram over a field that reacts to
 * the pointer, with their sentence underneath. It reads as a deliberate
 * treatment rather than as missing art, so the page can ship before the shoot
 * and the layout does not have to change when the photographs arrive: the
 * monogram tile is the same box an image will occupy.
 *
 * The cards lift on a scrub rather than a one-shot, so the row assembles as the
 * reader passes and settles rather than popping. Under reduced motion the row is
 * simply there, which is what the markup already says.
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
    end: "bottom 60%",
    fallback: 1,
  });

  return (
    <div
      ref={trilha}
      className={cn(
        "grid gap-px sm:grid-cols-2 lg:grid-cols-4",
        tom === "escuro" ? "bg-white/10" : "bg-black/10",
        className,
      )}
    >
      {pessoas.map((pessoa, index) => (
        <Cartao
          key={`${pessoa.papel}-${index}`}
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

/**
 * Initials of a name, for the placeholder tile.
 *
 * Falls back to the first two letters of the role when the name is still "A
 * definir", so the tile never renders as "AD" for four different people.
 */
function iniciais(pessoa: Pessoa): string {
  const fonte = pessoa.nome.trim().toLowerCase().startsWith("a definir")
    ? pessoa.papel
    : pessoa.nome;
  const partes = fonte.split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? [partes[0], partes[1]] : [fonte];
  return letras
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
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

  const y = useTransform(progresso, [de, ate], [30, 0]);
  const opacity = useTransform(progresso, [de, ate], [0, 1]);

  return (
    <motion.div
      style={animado ? { y, opacity } : undefined}
      className={cn(
        "group relative p-7 md:p-8",
        tom === "escuro" ? "bg-neutral-950" : "bg-white",
      )}
    >
      {/*
        The tile a photograph will occupy. `aspect-[4/5]` is a portrait crop, so
        swapping the monogram for an <Image fill> later changes nothing about the
        layout and cannot introduce a shift.
      */}
      <div
        className={cn(
          "inclina-ponteiro relative grid aspect-[4/5] w-full place-items-center overflow-hidden border",
          tom === "escuro"
            ? "border-white/12 bg-white/[0.03]"
            : "border-black/10 bg-black/[0.03]",
        )}
        style={{ "--inclina": "5deg" } as React.CSSProperties}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0",
            tom === "escuro" ? "campo-reativo" : "campo-reativo campo-reativo--claro",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "relative [font-family:var(--font-bricolage)] text-[clamp(2.5rem,6vw,3.5rem)] font-extrabold tracking-[-0.05em]",
            tom === "escuro" ? "text-white/15" : "text-black/15",
          )}
        >
          {iniciais(pessoa)}
        </span>
      </div>

      <p
        className={cn(
          "mt-6 [font-family:var(--font-bricolage)] text-lg font-semibold tracking-tight",
          tom === "escuro" ? "text-white" : "text-black",
        )}
      >
        {pessoa.nome}
      </p>
      <p
        className={cn(
          "mt-1 [font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.16em]",
          tom === "escuro" ? "text-white/40" : "text-black/40",
        )}
      >
        {pessoa.papel}
      </p>
      <p
        className={cn(
          "mt-4 text-sm leading-relaxed",
          tom === "escuro" ? "text-white/55" : "text-black/55",
        )}
      >
        {pessoa.fala}
      </p>
    </motion.div>
  );
}
