"use client";

import React from "react";

import { CabecalhoDaCena } from "./comandos/cabecalho-da-cena";
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
 * O título de cada metade é passado PARA a cena, que o põe dentro do palco
 * grudado: fora dele, ele saía da tela no primeiro rolar e a cena ficava
 * órfã. A cópia continua morando aqui, que é onde se lê a seção inteira.
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
      className="border-t border-white/[0.06] bg-[var(--app-bg)] py-24 text-[var(--app-text)] md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <LeituraAoVivo
          cabecalho={
            <CabecalhoDaCena
              sobrancelha="O que você pode pedir"
              titulo="Escreva como você falaria."
              texto="Sem comando, sem formato, sem palavra reservada. Por texto ou por áudio, no WhatsApp ou dentro do aplicativo. Veja o que ele entende de cada frase."
            />
          }
        />

        <div className="mt-20 md:mt-24">
          <MesaDeOperacoes
            cabecalho={
              <CabecalhoDaCena
                nivel="h3"
                titulo="E ele não para em anotar."
                texto="Registrar o gasto é onde os outros terminam. Estas são operações inteiras, feitas pela conversa."
              />
            }
          />
        </div>

        <div className="mt-16 md:mt-20">
          <CotaCompartilhada />
        </div>
      </div>
    </section>
  );
}
