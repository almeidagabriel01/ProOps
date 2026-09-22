import React from "react";

import { CenaPlanta } from "@/components/marketing/cena-planta/cena-planta";

/**
 * "Conheça a plataforma ProOps": a cena da planta, do ambiente especificado ao
 * dinheiro lançado no financeiro.
 *
 * Ela substituiu três vídeos de tela em carrossel pinado. A troca não é de
 * gosto: um vídeo mostra UMA tela de cada vez e pede que o leitor junte as
 * partes; a cena mostra o caminho inteiro numa só, que é justamente o que o
 * produto vende (uma base, não seis sistemas). E, como o mesmo projeto é
 * reescrito no vocabulário de três negócios pelas abas, ela também responde a
 * pergunta que faz alguém fechar a aba na primeira dobra: "isto serve para o
 * meu segmento?".
 *
 * A seção é uma faixa ESCURA no meio de uma página clara, e isso é deliberado:
 * a cena é uma maquete iluminada, e maquete se olha no escuro.
 *
 * Componente de servidor. O conteúdo inteiro está no HTML; o que hidrata depois
 * é o diretor da cena (rolagem e ponteiro) e as abas de nicho.
 */
export function LandingCenaPlanta() {
  return (
    <section
      aria-label="Conheça a plataforma ProOps"
      className="superficie-noite relative isolate"
    >
      <div className="mx-auto w-full max-w-7xl px-6 pb-4 pt-24 md:px-10 md:pt-32">
        <p className="text-sm font-semibold text-[rgb(var(--tungstenio))]">A plataforma</p>
        <h2 className="mt-4 max-w-3xl [font-family:var(--font-bricolage)] text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
          Do ambiente especificado ao dinheiro no financeiro, na mesma base.
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 md:text-lg">
          Role e acompanhe uma proposta inteira: o que a sua equipe especifica
          vira item com preço, os itens montam a proposta, o cliente assina, e a
          entrada e as parcelas nascem lançadas. Troque o nicho do exemplo e
          repare no que muda: o catálogo e as palavras, nunca o caminho.
        </p>
      </div>

      <CenaPlanta />
    </section>
  );
}
