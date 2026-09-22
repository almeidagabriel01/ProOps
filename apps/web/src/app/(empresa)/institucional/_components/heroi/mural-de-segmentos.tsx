import React from "react";

import { cn } from "@/lib/utils";

import { HEROI_RAIZ, SEGMENTOS } from "../../_content/institucional-copy";

/**
 * A cena do herói da raiz: um mural com os negócios que vendem projeto.
 *
 * É tipografia fazendo o trabalho de ilustração, e é a resposta mais direta
 * possível à pergunta que faz alguém fechar a aba na primeira tela: "isto serve
 * para o meu negócio?". A ProOps nasceu na automação residencial, e duas
 * versões deste herói contaram isso por meio de UM nicho (uma casa com cortinas
 * e luzes). Quem vende outro tipo de projeto batia o olho e se excluía sozinho.
 *
 * Um bloco de luz percorre as células, uma de cada vez, e termina em "o seu",
 * que é a única célula pontilhada. O rótulo de baixo separa o que é pacote
 * pronto (os dois de `lib/niches/config.ts`, marcados) do que é configurado,
 * porque a lista inteira sem essa distinção seria promessa que a página não
 * pode cumprir.
 *
 * Componente de servidor, sem JavaScript: a passagem é uma animação CSS
 * escalonada por célula (`.mural-celula`), e a grade é desenhada com `gap-px`
 * sobre um fundo, então cada filete é uma linha só, e não duas bordas
 * encostadas.
 */

/** A célula de "o seu" entra no fim, depois de todos os segmentos. */
const TOTAL = SEGMENTOS.length + 1;
/** Quanto tempo a luz demora para dar a volta inteira. */
const CICLO = TOTAL * 0.8;

function estilo(indice: number): React.CSSProperties {
  return {
    "--mural-dur": `${CICLO}s`,
    "--mural-delay": `calc(var(--espera, 0s) + ${(indice * CICLO) / TOTAL + 0.6}s)`,
  } as React.CSSProperties;
}

export function MuralDeSegmentos() {
  const { rotulo, nota, seu } = HEROI_RAIZ.mural;

  return (
    <div className="w-full">
      <p className="mb-3 text-sm text-white/45">{rotulo}</p>

      <ul
        aria-label={rotulo}
        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/12 sm:grid-cols-3"
      >
        {SEGMENTOS.map((segmento, i) => (
          <li
            key={segmento.nome}
            style={estilo(i)}
            className="mural-celula relative flex min-h-[3.9rem] flex-col justify-center gap-1 bg-[var(--noite)] px-3.5 py-3 text-[13px] leading-tight text-white/70 md:min-h-[4.75rem] md:text-sm"
          >
            <span className="relative">{segmento.nome}</span>
            {segmento.pronto && (
              <span className="relative text-[11px] text-white/35">pacote pronto</span>
            )}
          </li>
        ))}

        {/* A última célula é a única pontilhada: ela é um convite, não um item
            da lista. */}
        <li
          style={estilo(SEGMENTOS.length)}
          className={cn(
            "mural-celula mural-celula--seu relative flex min-h-[3.9rem] flex-col justify-center gap-1",
            "bg-[var(--noite)] px-3.5 py-3 text-[13px] leading-tight text-white md:min-h-[4.75rem] md:text-sm",
          )}
        >
          <span className="relative font-semibold">{seu}</span>
          <span className="relative text-[11px] text-white/45">configurado</span>
        </li>
      </ul>

      <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/45">{nota}</p>
    </div>
  );
}
