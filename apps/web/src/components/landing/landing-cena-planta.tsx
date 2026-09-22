import React from "react";

import { CenaPlanta } from "@/components/marketing/cena-planta/cena-planta";

import { Accent, SectionHeading } from "./_shared/section-heading";

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
 * **A seção é da landing, não do site da empresa.** A cena veio de lá e chegou
 * aqui com a casca de lá: faixa escura de ponta a ponta, sobrancelha colorida e
 * um `<h2>` em Bricolage, no meio de uma página que é branca, tem título em
 * Montserrat com uma palavra em Playfair itálico e separa seção com filete. O
 * cabeçalho agora é o `SectionHeading` de todas as outras, e o escuro ficou
 * onde ele é argumento: DENTRO do palco, que é uma maquete iluminada, e maquete
 * se olha no escuro.
 *
 * O palco é `sticky`, então a moldura arredondada vai NELE
 * (`cena-planta.tsx`), nunca num ancestral: `overflow` em ancestral de sticky
 * desliga o sticky, e a cena passaria reto pela tela.
 *
 * Componente de servidor. O conteúdo inteiro está no HTML; o que hidrata depois
 * é o diretor da cena (rolagem e ponteiro) e as abas de nicho.
 */
export function LandingCenaPlanta() {
  return (
    <section
      aria-label="Conheça a plataforma ProOps"
      className="border-t border-black/10 bg-white pt-24 dark:border-white/10 dark:bg-neutral-950 md:pt-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="A plataforma"
          title={
            <>
              Do ambiente especificado ao <Accent>dinheiro no financeiro</Accent>,
              na mesma base.
            </>
          }
          description="Role e acompanhe uma proposta inteira: o que a sua equipe especifica vira item com preço, os itens montam a proposta, o cliente assina, e a entrada e as parcelas nascem lançadas. Troque o nicho do exemplo e repare no que muda: o catálogo e as palavras, nunca o caminho."
        />
      </div>

      <div className="mt-14 px-3 sm:px-5 md:mt-16 md:px-6">
        <CenaPlanta />
      </div>
    </section>
  );
}
