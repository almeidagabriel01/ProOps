import React from "react";

import { PERGUNTAS } from "../_content/faq";

/**
 * As objeções, respondidas.
 *
 * Os cinco concorrentes diretos têm FAQ, entre seis e dezoito perguntas, e esta
 * página não tinha nenhuma. Não é enfeite de SEO: as três primeiras perguntas
 * daqui são as que dominam o FAQ de todos eles, ou seja, são as dúvidas que o
 * visitante já chega tendo. Deixá-las sem resposta não as faz sumir, faz delas
 * objeção silenciosa.
 *
 * **Acordeão com `<details>` e `<summary>` nativos, sem uma linha de
 * JavaScript.** Abrir e fechar é comportamento do navegador, funciona antes de
 * qualquer bundle chegar, é navegável por teclado e anunciado por leitor de tela
 * sem `aria-expanded` escrito à mão. O `@layer base` do `globals.css` já dá
 * cursor de clique a `summary`, então não há classe a acrescentar no call site.
 *
 * `[&::-webkit-details-marker]:hidden` tira o triângulo padrão do Safari e do
 * Chrome; o sinal de mais desenhado ao lado é o nosso, e ele gira no `open`.
 *
 * O mesmo `PERGUNTAS` alimenta o `FAQPage` do JSON-LD, então a tela e o rich
 * snippet não podem divergir.
 */
export function AplicativoFaq() {
  return (
    <section
      id="faq"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />
          Perguntas
        </p>

        <h2 className="[font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          O que costumam perguntar.
        </h2>

        <div className="mt-12 divide-y divide-white/[0.07] border-y border-white/[0.07] md:mt-14">
          {PERGUNTAS.map((item) => (
            <details key={item.pergunta} className="group">
              <summary className="flex list-none items-start justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
                <h3 className="[font-family:var(--font-hanken)] text-base font-semibold leading-snug transition-colors group-hover:text-[var(--app-tint)] md:text-lg">
                  {item.pergunta}
                </h3>
                <span
                  aria-hidden="true"
                  className="relative mt-1 h-4 w-4 shrink-0 transition-transform duration-300 group-open:rotate-45"
                >
                  <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-[var(--app-text-muted)]" />
                  <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-[var(--app-text-muted)]" />
                </span>
              </summary>
              <p className="max-w-2xl pb-7 text-sm leading-relaxed text-[var(--app-text-muted)] md:text-base">
                {item.resposta}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
