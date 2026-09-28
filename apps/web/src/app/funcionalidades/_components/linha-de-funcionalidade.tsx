import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  caminhoDaFuncionalidade,
  recurso,
  seloDoPlano,
  type Funcionalidade,
} from "@/lib/landing/funcionalidades";

/**
 * Uma funcionalidade na lista: o nome, a explicação curta e o plano, e a linha
 * inteira leva à página dela. O link é o título (é ele que um leitor de tela
 * anuncia) e cobre a linha com um `::after`, para o clique valer em qualquer
 * ponto sem transformar a explicação num nome de link de três frases.
 */
export function LinhaDeFuncionalidade({ funcionalidade, nivel = "h3" }: { funcionalidade: Funcionalidade; nivel?: "h2" | "h3" }) {
  const Icone = funcionalidade.icone;
  const Titulo = nivel;
  const selo = seloDoPlano(recurso(funcionalidade.principal).requisito);
  return (
    <li className="vt-revela group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 border-t border-black/10 py-6 transition-colors duration-200 hover:bg-black/[0.025] dark:border-white/10 dark:hover:bg-white/[0.035] md:gap-x-6 md:px-3">
      <Icone className="mt-1 h-5 w-5 text-black/45 transition-colors duration-200 group-hover:text-black dark:text-white/45 dark:group-hover:text-white" aria-hidden />
      <div className="min-w-0 md:grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.3fr)_12rem] md:items-baseline md:gap-8">
        <Titulo className="[font-family:var(--font-pdf-montserrat)] text-lg font-bold leading-snug text-black dark:text-white md:text-xl">
          <Link
            href={caminhoDaFuncionalidade(funcionalidade.slug)}
            className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-black/40 dark:focus-visible:after:ring-white/50"
          >
            {funcionalidade.titulo}
          </Link>
        </Titulo>
        <p className="mt-1.5 text-[15px] leading-relaxed text-black/60 dark:text-white/60 md:mt-0">{funcionalidade.resumo}</p>
        <p className="mt-2 text-[13px] font-semibold text-black/70 dark:text-white/70 md:mt-0">{selo.rotulo}</p>
      </div>
      <ArrowRight
        className="mt-1 h-5 w-5 text-black/35 transition-[transform,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 group-hover:text-black dark:text-white/35 dark:group-hover:text-white"
        aria-hidden
      />
    </li>
  );
}
