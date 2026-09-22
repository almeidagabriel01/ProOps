import React from "react";

import { Marca } from "@/components/institucional/marca";

import { CANAIS } from "@/app/(empresa)/institucional/_content/institucional-copy";

import { FioDaConversa } from "./fio-da-conversa";

/**
 * O herói de /fale-conosco: as três conversas possíveis, já começadas.
 *
 * Cada assunto é uma conversa em miniatura: o motivo, escrito como quem chega
 * pensaria nele, e a resposta da ProOps, que aparece depois de alguns
 * instantes de "digitando". O prazo de resposta de cada fila fica no
 * cabeçalho, porque é a primeira pergunta de quem escreve. Clicar numa conversa
 * leva ao formulário com aquele assunto escolhido (`FioDaConversa`), e é por
 * isso que cada uma é um link e não uma ilustração.
 *
 * A digitação é CSS (`.conversa-digita`, `.conversa-responde`), e não texto
 * sendo escrito letra a letra por JavaScript: isto está acima da dobra, e um
 * leitor de tela lendo uma frase pela metade enquanto ela se escreve é pior do
 * que a frase inteira. O texto está todo no HTML desde o primeiro byte; o que
 * a animação faz é revelá-lo com `clip-path`, que não mexe em layout.
 */
export function HeroiConversas() {
  return (
    <ol className="mx-auto flex w-full max-w-lg flex-col gap-3">
      {CANAIS.map((canal, i) => {
        const atraso = 0.35 + i * 0.5;
        return (
          <li
            key={canal.titulo}
            className="hero-enter"
            style={{ "--hero-delay": `${0.2 + i * 0.12}s`, "--hero-y": "14px" } as React.CSSProperties}
          >
            <FioDaConversa
              titulo={canal.titulo}
              className="conversa group block rounded-2xl border border-white/10 bg-[var(--noite-alta)]/80 p-4 transition-colors duration-300 hover:border-[rgb(var(--realce)/0.45)] hover:bg-[var(--noite-alta)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--realce)/0.7)]"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">{canal.titulo}</span>
                <span className="text-xs text-white/45">{canal.prazo}</span>
              </span>

              <span className="mt-3 flex justify-end">
                <span className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--papel)] px-3 py-2 text-[13px] leading-snug text-[var(--tinta)]">
                  {canal.motivo}
                </span>
              </span>

              <span className="relative mt-2 flex items-end gap-2">
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-white"
                >
                  <Marca className="size-3.5" />
                </span>
                {/* A resposta ocupa o lugar dela desde o começo; os pontos de
                    "digitando" ficam por cima, e saem quando ela se revela. */}
                <span className="relative max-w-[85%]">
                  <span
                    className="conversa-responde block rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] leading-snug text-white/80"
                    style={{ "--conversa-delay": `${atraso + 0.9}s` } as React.CSSProperties}
                  >
                    {canal.texto}
                  </span>
                  <span
                    aria-hidden="true"
                    className="conversa-digita absolute bottom-0 left-0 flex gap-1 rounded-2xl rounded-bl-md bg-white/[0.08] px-3 py-3"
                    style={{ "--conversa-delay": `${atraso}s` } as React.CSSProperties}
                  >
                    {[0, 1, 2].map((ponto) => (
                      <span
                        key={ponto}
                        className="conversa-ponto block size-1.5 rounded-full bg-white/60"
                        style={{ "--ponto": `${ponto * 0.15}s` } as React.CSSProperties}
                      />
                    ))}
                  </span>
                </span>
              </span>

              <span className="mt-3 block text-right text-xs text-white/40 transition-colors duration-300 group-hover:text-[rgb(var(--realce))]">
                Escrever sobre {canal.titulo.toLowerCase()}
              </span>
            </FioDaConversa>
          </li>
        );
      })}
    </ol>
  );
}
