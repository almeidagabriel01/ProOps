"use client";

import React from "react";

import { PessoasFaixa } from "@/components/institucional/pessoas-faixa";
import { PlaceholderBadge } from "@/components/institucional/placeholder-badge";
import { Realce, TituloSecao } from "@/components/institucional/secao";
import { CurtainLink } from "@/components/marketing/_shared/curtain-transition";
import { Magnetic } from "@/components/marketing/_shared/magnetic";

import { PESSOAS } from "../_content/institucional-copy";

/**
 * Who makes it, on the root pass.
 *
 * The company page has to answer "who am I buying from" before the closing, and
 * a logo plus a claim does not answer it. This is the shorter version of what
 * `/sobre` says at length, which is also why it ends with a link there instead
 * of repeating the history: the root experience introduces, the sub-page tells.
 */
export function InstitucionalTime() {
  return (
    <section
      aria-label="Quem faz a ProOps"
      className="relative isolate overflow-hidden border-t border-white/10 bg-neutral-950 px-6 py-24 text-white md:px-10 md:py-32"
    >
      <div aria-hidden="true" className="campo-reativo pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <PlaceholderBadge>nomes e falas a confirmar</PlaceholderBadge>
        <TituloSecao
          sobrancelha="Quem faz"
          titulo={
            <>
              Tem <Realce>gente</Realce> atrás do produto.
            </>
          }
          descricao="Time pequeno, e de propósito: quem atende é quem constrói, então o que você conta numa conversa chega em quem escreve o código."
          className="mb-14"
        />

        <PessoasFaixa pessoas={PESSOAS} />

        <div className="mt-14">
          <Magnetic>
            <CurtainLink
              href="/sobre"
              className="group inline-flex items-center gap-2 border-b border-white/25 pb-1.5 text-base text-white transition-colors hover:border-white"
            >
              A história completa
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
