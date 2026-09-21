"use client";

import React, { useRef } from "react";
import { m as motion, useTransform } from "motion/react";

import { Realce, TituloSecao } from "@/components/institucional/secao";
import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { useHolofote } from "@/components/marketing/_shared/use-holofote";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";

import { PESSOAS } from "../_content/institucional-copy";

/**
 * Who makes it, named and nothing more.
 *
 * The first version was the full card set from `/sobre`, photographs and quotes
 * and all, one scroll earlier. That is the repetition this pass exists to kill:
 * a reader who saw the faces here has no reason left to open "Sobre", and a
 * reader who opens it finds the page they already read.
 *
 * So the root gets the FACT (there are three, two of them write the code) and
 * the sub-page gets the people. Names in a hairline row, the roles under them,
 * and a link. The row is also the right shape for the fact: three names side by
 * side say "small team" faster than three paragraphs claiming it.
 */
export function InstitucionalTime() {
  const trilha = useRef<HTMLDivElement>(null);
  const holofote = useHolofote<HTMLDivElement>();
  const { progress, animated } = useScrollProgress(trilha, {
    start: "top 85%",
    end: "bottom 70%",
    fallback: 1,
  });

  return (
    <section
      aria-label="Quem faz a ProOps"
      className="relative isolate overflow-hidden border-t border-white/10 bg-neutral-950 px-6 py-24 text-white md:px-10 md:py-32"
    >
      <div aria-hidden="true" className="campo-reativo pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <TituloSecao
          sobrancelha="Quem faz"
          titulo={
            <>
              Três pessoas. <Realce>Duas</Realce> escrevem o código.
            </>
          }
          descricao="Não existe camada entre quem atende e quem constrói, e é essa a única razão de o time ser pequeno de propósito."
          className="mb-14"
        />

        <div ref={holofote}>
          <div
            ref={trilha}
            className="grid gap-px border-t border-white/10 bg-white/10 md:grid-cols-3"
          >
            {PESSOAS.map((pessoa, index) => (
              <Nome
                key={pessoa.nome}
                nome={pessoa.nome}
                papel={pessoa.papel}
                formacao={pessoa.formacao}
                indice={index}
                total={PESSOAS.length}
                progresso={progress}
                animado={animated}
              />
            ))}
          </div>
        </div>

        <div className="mt-14">
          <Magnetic>
            <CurtainLink
              href="/sobre"
              className="group inline-flex items-center gap-2 border-b border-white/25 pb-1.5 text-base text-white transition-colors hover:border-white"
            >
              Conhecer as três
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
    </section>
  );
}

function Nome({
  nome,
  papel,
  formacao,
  indice,
  total,
  progresso,
  animado,
}: {
  nome: string;
  papel: string;
  formacao?: string;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
}) {
  const fatia = 0.5 / total;
  const de = 0.05 + indice * fatia;
  const ate = de + fatia * 2.4;

  const y = useTransform(progresso, [de, ate], [26, 0]);
  const opacity = useTransform(progresso, [de, ate], [0, 1]);

  return (
    <motion.div
      data-holofote
      style={animado ? { y, opacity } : undefined}
      className="holofote group relative isolate bg-neutral-950 px-7 py-9 md:px-8 md:py-10"
    >
      <span
        aria-hidden="true"
        className="cantoneira absolute inset-0 text-white"
      />
      <p className="relative [font-family:var(--font-bricolage)] text-2xl font-semibold tracking-tight text-white md:text-[1.7rem]">
        {nome}
      </p>
      <p className="relative mt-3 [font-family:var(--font-geist-mono)] text-[10px] uppercase leading-relaxed tracking-[0.18em] text-white/45">
        {papel}
      </p>
      {formacao && (
        <p className="relative mt-4 text-sm leading-relaxed text-white/50">
          {formacao}
        </p>
      )}
    </motion.div>
  );
}
