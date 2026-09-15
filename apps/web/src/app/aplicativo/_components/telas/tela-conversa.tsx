"use client";

import React from "react";
import {
  m as motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "motion/react";

import { cn } from "@/lib/utils";

import {
  BarraDeStatus,
  CabecalhoApp,
  Dinheiro,
  TabBar,
  TelaApp,
} from "./pecas";

/**
 * A aba Agente, reconstruída, com uma conversa de verdade dentro.
 *
 * Isto conserta um buraco, e não é cosmético: `mockup-ios/agenda.jpg` e
 * `mockup-android/agente.jpg` são a mesma tela, e estão praticamente VAZIAS. Uma
 * conversa antiga sobre fundo preto, mais nada. Ela está na prateleira de telas
 * da página e é, de longe, a pior imagem dali: a aba que mais importa para o
 * argumento do produto é a que parece que o produto não faz nada.
 *
 * A conversa daqui NÃO é a do WhatsApp. É o mesmo agente, no outro canal, e a
 * página inteira depende de a diferença entre os dois ficar visível: as bolhas
 * daqui vivem dentro da moldura do aplicativo, com a barra de digitação e a tab
 * bar embaixo, enquanto as da cena "Um dia" vivem num painel de conversa.
 *
 * Quando `progresso` é passado, cada mensagem tem a própria fatia dele e chega
 * conforme o leitor desce. Sem ele, ou sob `prefers-reduced-motion`, a conversa
 * inteira já está escrita: o estado final é o que o servidor renderiza.
 */

export interface MensagemApp {
  de: "voce" | "ia";
  texto: string;
  hora: string;
  /** O resultado estruturado, como o aplicativo o mostra abaixo da resposta. */
  cartao?: { titulo: string; meta: string; valor: string };
}

interface TelaConversaProps {
  mensagens: MensagemApp[];
  hora?: string;
  /** 0..1 da cena que hospeda a tela. Ausente, tudo já está visível. */
  progresso?: MotionValue<number>;
  /** Fatia do progresso em que a conversa inteira acontece. */
  janela?: [number, number];
}

export function TelaConversa({
  mensagens,
  hora = "21:04",
  progresso,
  janela = [0, 1],
}: TelaConversaProps) {
  return (
    <TelaApp>
      <BarraDeStatus hora={hora} />
      <CabecalhoApp
        acao={
          <span className="flex h-[8cqw] w-[8cqw] items-center justify-center rounded-full bg-[var(--app-element)] text-[4.4cqw] leading-none text-[var(--app-text-muted)]">
            +
          </span>
        }
      />

      {/* `justify-end` porque uma conversa cresce de baixo para cima, e é o que
          deixa a última mensagem sempre colada na barra de digitação. */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-[2.4cqw] px-[4.4cqw] pb-[2cqw]">
        {mensagens.map((mensagem, i) => (
          <Bolha
            key={mensagem.texto}
            mensagem={mensagem}
            indice={i}
            total={mensagens.length}
            progresso={progresso}
            janela={janela}
          />
        ))}
      </div>

      <BarraDeDigitacao />
      <TabBar ativa="agente" />
    </TelaApp>
  );
}

function Bolha({
  mensagem,
  indice,
  total,
  progresso,
  janela,
}: {
  mensagem: MensagemApp;
  indice: number;
  total: number;
  progresso?: MotionValue<number>;
  janela: [number, number];
}) {
  // Cada mensagem ocupa uma fatia da janela e chega na primeira metade dela, de
  // modo que a conversa fica parada entre uma e outra em vez de escorrer.
  const [inicio, fim] = janela;
  const passo = (fim - inicio) / total;
  const de = inicio + passo * indice;
  const ate = de + passo * 0.55;

  // Hooks são sempre chamados: o `progresso` decide se o resultado é USADO, não
  // se ele existe. Chamar condicionalmente quebraria a ordem dos hooks assim que
  // a cena trocasse de modo no meio da vida do componente.
  const alvo = useMotionValueSeguro(progresso);
  const opacity = useTransform(alvo, [de, ate], [0, 1]);
  const y = useTransform(alvo, [de, ate], [14, 0]);

  const meu = mensagem.de === "voce";

  return (
    <motion.div
      style={progresso ? { opacity, y } : undefined}
      className={cn("flex", meu ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[84%] rounded-[3.6cqw] px-[3.4cqw] py-[2.6cqw]",
          meu
            ? "bg-[var(--app-tint)]/[0.16] text-[var(--app-text)]"
            : "border border-[var(--app-card-border)] bg-[var(--app-surface)] text-[var(--app-text)]",
        )}
      >
        <p className="text-[3.4cqw] leading-relaxed">{mensagem.texto}</p>

        {mensagem.cartao ? (
          <div className="mt-[2.4cqw] flex items-center gap-[2.4cqw] rounded-[2.8cqw] bg-[var(--app-bg)]/70 p-[2.6cqw]">
            <span
              aria-hidden="true"
              className="grid h-[7cqw] w-[7cqw] shrink-0 place-items-center rounded-[2cqw] bg-[var(--app-tint)]/15"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[3.6cqw] w-[3.6cqw] stroke-[var(--app-tint)]"
              >
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[3.1cqw] font-semibold">
                {mensagem.cartao.titulo}
              </span>
              <span className="block truncate text-[2.7cqw] text-[var(--app-text-muted)]">
                {mensagem.cartao.meta}
              </span>
            </span>
            <Dinheiro className="text-[3.2cqw] font-semibold">
              {mensagem.cartao.valor}
            </Dinheiro>
          </div>
        ) : null}

        <p className="mt-[1.4cqw] text-right [font-family:var(--font-jetbrains-mono)] text-[2.4cqw] text-[var(--app-text-muted)]">
          {mensagem.hora}
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Um `MotionValue` sempre, mesmo sem cena por trás.
 *
 * `useTransform` precisa de uma fonte, e a fonte aqui é opcional. Devolver um
 * valor constante quando ela falta mantém a contagem de hooks estável, que é o
 * que permite a MESMA tela servir à cena dirigida por scroll e à prateleira
 * parada da galeria.
 */
function useMotionValueSeguro(valor?: MotionValue<number>): MotionValue<number> {
  const reserva = useMotionValue(1);
  return valor ?? reserva;
}

/** A barra de digitação. Cenário: ela não recebe foco nem digita nada aqui. */
function BarraDeDigitacao() {
  return (
    <div
      aria-hidden="true"
      className="mx-[4.4cqw] mb-[16cqw] flex items-center gap-[2.6cqw] rounded-full border border-[var(--app-card-border)] bg-[var(--app-surface)] px-[4cqw] py-[2.8cqw]"
    >
      <span className="flex-1 text-[3.2cqw] text-[var(--app-text-muted)]">
        Pergunte ou peça alguma coisa
      </span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[4.2cqw] w-[4.2cqw] shrink-0 stroke-[var(--app-text-muted)]"
      >
        <path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z" />
        <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18.5V22" />
      </svg>
    </div>
  );
}
