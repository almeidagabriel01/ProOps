import React from "react";
import { ArrowRight } from "lucide-react";

import { Marquee } from "@/components/marketing/_shared/marquee";

import { LandingButton } from "./landing-button";

interface FechoCtaProps {
  titulo: React.ReactNode;
  frase: string;
  primario: { rotulo: string; href: string };
  secundario?: { rotulo: string; href: string };
  /** Nomes que passam na faixa do alto, como as estações de um painel de embarque. */
  estacoes?: readonly string[];
}

/**
 * O fechamento das páginas de venda do ERP: uma frase grande, a ação, e uma
 * faixa lenta com o nome do que a página mostrou, passando como as estações
 * num painel de linha. É o fim da viagem que o mapa do topo começou.
 *
 * Componente de servidor; só a faixa (`Marquee`) é cliente, e ela para fora da
 * tela e sob movimento reduzido.
 */
export function FechoCta({ titulo, frase, primario, secundario, estacoes }: FechoCtaProps) {
  return (
    <section className="relative overflow-hidden border-t border-black/10 bg-white py-24 dark:border-white/10 dark:bg-neutral-950 md:py-32">
      {estacoes?.length ? (
        <Marquee
          duracao={Math.max(40, estacoes.length * 2.2)}
          className="mb-16 border-y border-black/10 py-4 dark:border-white/10 md:mb-20"
          faixaClassName="gap-0"
        >
          {estacoes.map((nome) => (
            <span
              key={nome}
              className="flex items-center gap-4 whitespace-nowrap px-4 text-sm font-medium text-black/55 dark:text-white/55"
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-black/50 dark:border-white/55" />
              {nome}
            </span>
          ))}
        </Marquee>
      ) : null}

      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="vt-revela [font-family:var(--font-pdf-montserrat)] text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-black dark:text-white md:text-6xl">
          {titulo}
        </h2>
        <p className="vt-revela mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-black/60 dark:text-white/60">
          {frase}
        </p>
        <div className="vt-revela mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <LandingButton
            href={primario.href}
            variant="solid"
            size="lg"
            fullWidth
            className="sm:w-auto"
            trailingIcon={<ArrowRight className="h-5 w-5" />}
          >
            {primario.rotulo}
          </LandingButton>
          {secundario ? (
            <LandingButton href={secundario.href} variant="link">
              {secundario.rotulo}
            </LandingButton>
          ) : null}
        </div>
      </div>
    </section>
  );
}
