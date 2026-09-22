import React from "react";

import { cn } from "@/lib/utils";

import { HeroiFicha, type DadoDoHero } from "./heroi-ficha";
import { HeroiTitulo } from "./heroi-titulo";
import { HeroiSecao, SaiComARolagem } from "./saida-do-heroi";

interface HeroiPalcoProps {
  /** O `aria-label` da seção: o nome da página, curto. */
  rotulo: string;
  /** As linhas do `<h1>`, como `LinhaHero`. */
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  /** Até três fatos, na linha de créditos do rodapé. */
  ficha?: DadoDoHero[];
  /**
   * A cena da página: o assunto dela em forma de coisa, e não um enfeite. É o
   * que impede que quatro sub-páginas abram com o mesmo cartão e as palavras
   * trocadas, que foi o defeito da versão anterior.
   */
  cena: React.ReactNode;
  /**
   * `lado`: a copia à esquerda e a cena à direita, empilhadas no celular.
   * `centro`: a copia centrada, e a cena embaixo dela, na largura toda. É
   * composição, não alinhamento de texto: uma página que é uma declaração (o
   * manifesto) não se lê como uma que é um índice.
   */
  composicao?: "lado" | "centro";
  /** Debaixo da descrição: um CTA, uma linha de apoio. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * A abertura de uma sub-página do site da empresa.
 *
 * Três regras, e cada uma já custou uma versão:
 *
 * - **Tela cheia, sempre** (`min-h-[100svh]`). Um herói de 82svh deixa uma
 *   faixa da seção seguinte no rodapé, e essa faixa faz a abertura parecer um
 *   cabeçalho alto em vez de uma tela.
 * - **Acima da dobra é CSS.** Título, descrição e ficha entram por
 *   `.hero-enter`/`.hero-rise-line`, que tocam no primeiro paint sem
 *   JavaScript. A cena de cada página segue a mesma regra, com as classes dela.
 * - **A cena é do assunto.** Cada página passa a própria, e ela ocupa espaço de
 *   verdade na composição, no celular inclusive: ela deixou de ser textura
 *   sangrando pela borda, escondida abaixo de `md`.
 *
 * O material é `.superficie-noite` (globals.css), o mesmo do herói da raiz: as
 * quatro páginas e a raiz se leem como um site só pela luz, e não por um
 * elemento repetido.
 */
export function HeroiPalco({
  rotulo,
  titulo,
  descricao,
  ficha,
  cena,
  composicao = "lado",
  children,
  className,
}: HeroiPalcoProps) {
  const centro = composicao === "centro";

  return (
    <HeroiSecao
      rotulo={rotulo}
      className={cn(
        "superficie-noite relative isolate flex min-h-[100svh] flex-col overflow-hidden px-6 pb-9 pt-32 md:px-10 md:pb-11 md:pt-40",
        className,
      )}
    >
      <div aria-hidden="true" className="superficie-noite__luz pointer-events-none absolute inset-0" />

      <div
        className={cn(
          "relative z-10 mx-auto w-full max-w-6xl",
          centro
            ? "flex flex-col items-center gap-12 text-center md:gap-14"
            : "grid items-center gap-12 lg:grid-cols-12 lg:gap-10",
        )}
      >
        <SaiComARolagem
          papel="copia"
          className={cn(centro ? "max-w-4xl" : "lg:col-span-6")}
        >
          <HeroiTitulo>{titulo}</HeroiTitulo>
          {descricao && (
            <p
              className={cn(
                "hero-enter mt-8 max-w-xl text-base leading-relaxed text-white/65 md:text-lg",
                centro && "mx-auto",
              )}
              style={
                {
                  "--hero-y": "16px",
                  "--hero-delay": "0.42s",
                } as React.CSSProperties
              }
            >
              {descricao}
            </p>
          )}
          {children && (
            <div
              className="hero-enter mt-10"
              style={
                {
                  "--hero-y": "12px",
                  "--hero-delay": "0.68s",
                  "--hero-dur": "0.5s",
                } as React.CSSProperties
              }
            >
              {children}
            </div>
          )}
        </SaiComARolagem>

        <SaiComARolagem
          papel="cena"
          className={cn(centro ? "w-full" : "lg:col-span-6")}
        >
          {cena}
        </SaiComARolagem>
      </div>

      {ficha && ficha.length > 0 && (
        <SaiComARolagem papel="ficha" className="relative z-10 mt-auto w-full">
          <HeroiFicha dados={ficha} centrada={centro} />
        </SaiComARolagem>
      )}
    </HeroiSecao>
  );
}
