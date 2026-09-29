import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ImagemDaCaptura } from "@/components/landing/_shared/captura-do-erp";
import { CAPTURAS_DAS_FUNCIONALIDADES } from "@/lib/landing/capturas";
import {
  caminhoDaFuncionalidade,
  recurso,
  seloDoPlano,
  type Funcionalidade,
} from "@/lib/landing/funcionalidades";
import { cn } from "@/lib/utils";

interface CardDeFuncionalidadeProps {
  funcionalidade: Funcionalidade;
  /** Nível do título dentro da página em que o card aparece. */
  nivel?: "h2" | "h3";
}

/**
 * Uma funcionalidade como card: o print de verdade da tela dela no topo, o
 * nome, a explicação curta e o plano. O nome é o link e cobre o card com um
 * `::after`, então o clique vale em qualquer ponto e o leitor de tela anuncia
 * só o nome, não o card inteiro.
 *
 * O print de desktop tem a mesma proporção do quadro (16:10) e entra inteiro;
 * o de celular fica de pé, centralizado, com a borda arredondada de um
 * aparelho.
 */
export function CardDeFuncionalidade({ funcionalidade: f, nivel = "h3" }: CardDeFuncionalidadeProps) {
  const Titulo = nivel;
  const Icone = f.icone;
  const captura = CAPTURAS_DAS_FUNCIONALIDADES[f.slug];
  const selo = seloDoPlano(recurso(f.principal).requisito);
  const celular = captura.formato === "celular";

  return (
    <li className="vt-revela group relative flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white transition-[border-color,box-shadow] duration-300 hover:border-black/25 hover:shadow-[0_24px_50px_-30px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-neutral-900 dark:hover:border-white/25 dark:hover:shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)]">
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden border-b border-black/10 bg-neutral-100 dark:border-white/10 dark:bg-neutral-800",
          celular && "flex items-end justify-center pt-5",
        )}
      >
        {celular ? (
          <ImagemDaCaptura
            captura={captura}
            decorativa
            sizes="160px"
            className="h-[118%] w-auto self-start rounded-[1.4rem] border-4 border-neutral-900 object-cover object-top shadow-[0_18px_40px_-20px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1.5"
          />
        ) : (
          <ImagemDaCaptura
            captura={captura}
            decorativa
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 md:p-6">
        <Titulo className="flex items-center gap-2.5 [font-family:var(--font-pdf-montserrat)] text-lg font-bold leading-snug text-black dark:text-white">
          <Icone className="h-5 w-5 shrink-0 text-black/45 dark:text-white/45" aria-hidden />
          <Link
            href={caminhoDaFuncionalidade(f.slug)}
            className="outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-black/40 dark:focus-visible:after:ring-white/50"
          >
            {f.titulo}
          </Link>
        </Titulo>
        <p className="mt-2 flex-1 text-[15px] leading-relaxed text-black/60 dark:text-white/60">{f.resumo}</p>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-black/10 pt-4 dark:border-white/10">
          <span className="text-[13px] font-semibold text-black/70 dark:text-white/70">{selo.rotulo}</span>
          <ArrowRight
            aria-hidden
            className="h-4 w-4 text-black/35 transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-black dark:text-white/35 dark:group-hover:text-white"
          />
        </div>
      </div>
    </li>
  );
}
