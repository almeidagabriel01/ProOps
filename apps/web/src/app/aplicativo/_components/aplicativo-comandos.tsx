"use client";

import React from "react";

import { CotaCompartilhada } from "./comandos/cota-compartilhada";
import { LeituraAoVivo } from "./comandos/leitura-ao-vivo";
import { MesaDeOperacoes } from "./comandos/mesa-de-operacoes";

/**
 * O que a pessoa pode pedir, e o que o agente faz com isso.
 *
 * Duas metades com perguntas diferentes, e cada uma com a peça que responde a
 * sua pergunta sem precisar de texto:
 *
 * 1. **"Ele entende do meu jeito?"** A roda de pedidos (o seletor do iOS) e a
 *    leitura ao vivo da frase no centro dela: a frase é digitada, as partes
 *    reconhecidas acendem e voam para os campos de uma ficha. Referência:
 *    Fantastical e Things, que leem linguagem natural enquanto se digita.
 * 2. **"E depois?"** A mesa de operações: seis pedidos que a categoria não
 *    atende, cada um com um diagrama do efeito real (parcelas distribuídas
 *    sobre as faturas, a sobra que se bifurca, o limite que volta).
 *
 * Isto substituiu duas faixas de frases correndo em sentidos opostos e uma
 * grade de seis cartões com texto: as duas mostravam que existiam pedidos, e
 * nenhuma mostrava o que acontecia com eles.
 *
 * ── A rolagem conduz ───────────────────────────────────────────────────────
 *
 * As duas metades são palcos grudados em trilhos altos, e cada frase ou
 * operação ocupa uma fatia da rolagem: a animação avança e volta com a página,
 * em vez de tocar sozinha num relógio. Uma versão com revezamento automático
 * existiu e foi trocada por esta, porque quem lê não controlava o ritmo.
 *
 * ── Custo ──────────────────────────────────────────────────────────────────
 *
 * Três ScrollTriggers (os dois trilhos e a faixa de cota), todos criados por
 * IntersectionObserver via `useScrollProgress`, fora da hidratação. As
 * timelines só nascem quando a região chega perto (`useVisibilidade`), e só a
 * frase e a cena atuais têm uma.
 *
 * A seção NÃO leva `overflow-hidden`: overflow em qualquer ancestral desliga o
 * `sticky` dos palcos sem erro nenhum.
 */
export function AplicativoComandos() {
  return (
    <section
      id="comandos"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] py-28 text-[var(--app-text)] md:py-36"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />O que você pode
          pedir
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          Escreva como você falaria.
        </h2>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)]">
          Sem comando, sem formato, sem palavra reservada. Por texto ou por
          áudio, no WhatsApp ou dentro do aplicativo. Veja o que ele entende de
          cada frase.
        </p>

        <div className="mt-14 md:mt-20">
          <LeituraAoVivo />
        </div>

        <div className="mt-28 md:mt-40">
          <h3 className="max-w-2xl [font-family:var(--font-hanken)] text-2xl font-bold leading-[1.15] tracking-[-0.02em] md:text-4xl">
            E ele não para em anotar.
          </h3>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)]">
            Registrar o gasto é onde os outros terminam. Estas são operações
            inteiras, feitas pela conversa.
          </p>

          <div className="mt-10 md:mt-14">
            <MesaDeOperacoes />
          </div>

          <div className="mt-6 md:mt-10">
            <CotaCompartilhada />
          </div>
        </div>
      </div>
    </section>
  );
}
