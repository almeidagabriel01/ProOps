"use client";

import React from "react";
import {
  cubicBezier,
  m as motion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { HidratarPerto } from "@/components/marketing/_shared/hidratar-perto";
import { useMediaQuery } from "@/components/marketing/_shared/use-media-query";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";

import { TelaConversa, type MensagemApp } from "./telas/tela-conversa";

/**
 * Uma conversa só, indo até o fim, sem sair do aplicativo.
 *
 * A cena "Um dia" mostra seis momentos curtos; esta mostra UM longo. A
 * diferença importa: a objeção de quem já testou um concorrente não é "ele
 * entende?", é "e depois?". Aqui a pergunta vira operação, a operação pede
 * confirmação, a confirmação executa e o limite volta, tudo na mesma linha de
 * conversa e sem ninguém abrir formulário.
 *
 * ── Por que `sticky` e não `pin` ────────────────────────────────────────────
 *
 * A página já tem dois pins (o dia e a prateleira). Um `pin` do ScrollTrigger
 * insere um espaçador e reescreve a altura do documento, e com vários deles
 * isso vira medição a cada refresh; o CLAUDE.md do site da empresa registra a
 * mesma decisão pelo mesmo motivo. `sticky` não mede nada.
 *
 * O preço do `sticky` é uma regra dura: **nenhum ancestral pode ter
 * `overflow`**, porque overflow em qualquer ancestral desliga `position: sticky`
 * nos descendentes. O sintoma é a cena passar reto, sem erro e com o layout
 * ainda parecendo quase certo. Por isso esta seção NÃO leva `overflow-hidden`.
 *
 * ── Estado final ────────────────────────────────────────────────────────────
 *
 * Sob `prefers-reduced-motion` o `useScrollProgress` devolve `animated: false` e
 * nenhum `style` é aplicado: a conversa inteira já está escrita, o palco não
 * gruda (a altura extra só existe de `md` para cima) e a seção vira um bloco
 * normal com o telefone e o texto lado a lado.
 */

const CONVERSA: MensagemApp[] = [
  {
    de: "voce",
    texto: "quanto tá a fatura do cartão da casa?",
    hora: "21:04",
  },
  {
    de: "ia",
    texto:
      "R$ 1.590,00. Fecha dia 20 e vence dia 27. Disponível agora: R$ 4.337,00.",
    hora: "21:04",
  },
  { de: "voce", texto: "paguei ela agora", hora: "21:05" },
  {
    de: "ia",
    texto:
      "Confirma que dou baixa em R$ 1.590,00, parcela por parcela? Responda sim ou não.",
    hora: "21:05",
  },
  { de: "voce", texto: "sim", hora: "21:05" },
  {
    de: "ia",
    texto: "Pronto. Limite devolvido, disponível agora R$ 5.927,00.",
    hora: "21:05",
    cartao: {
      titulo: "Fatura paga",
      meta: "Cartão da casa · 6 parcelas baixadas",
      valor: "R$ 1.590,00",
    },
  },
];

/** Os três beats, ancorados nas mesmas fatias que revelam as mensagens. */
export const BEATS = [
  {
    em: 0.1,
    titulo: "Ele responde",
    destaque: "com o número certo.",
    texto:
      "Fatura atual, data de fechamento, vencimento e limite disponível. Não é um resumo do que você gastou: é o estado do cartão agora.",
  },
  {
    em: 0.45,
    titulo: "E então",
    destaque: "ele executa.",
    texto:
      "Dar baixa numa fatura é mexer em todas as parcelas que entraram nela. O agente faz isso, e devolve o limite junto. É a metade que os apps de anotação não têm.",
  },
  {
    em: 0.78,
    titulo: "Nada disso acontece",
    destaque: "sem um sim.",
    texto:
      "O que é difícil de desfazer nunca é executado sozinho: vira uma pendência que espera sua confirmação, e some se você não responder.",
  },
];

export function AplicativoConversa() {
  return (
    <HidratarPerto>
      <CorpoDaConversa />
    </HidratarPerto>
  );
}

function CorpoDaConversa() {
  const palco = React.useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(palco, {
    start: "top top",
    end: "bottom bottom",
    fallback: 1,
  });
  // O progresso cru segue a roda pixel a pixel, e é isso que deixava a cena
  // seca: cada tique de scroll era um degrau na tela. A mola dá inércia sem
  // atrasar o suficiente para descolar do que o leitor está fazendo.
  const suave = useSpring(progress, MOLA);

  /**
   * A cena só é dirigida pelo scroll ONDE O PALCO GRUDA, que é de `md` para
   * cima: a altura extra (`md:h-[260vh]`) e o `sticky` são os dois `md:`.
   *
   * No celular o palco tem a altura do próprio conteúdo, então o intervalo do
   * ScrollTrigger é quase zero e o progresso saltava de 0 a 1 em poucos
   * pixels: as seis mensagens ficavam invisíveis quase o tempo todo e os três
   * beats se revezavam num piscar. Sem o progresso, a conversa inteira já está
   * escrita, que é o estado final e o que o servidor manda.
   */
  const palcoGruda = useMediaQuery("(min-width: 768px)");
  const dirigido = animated && palcoGruda;

  return (
    <section
      id="conversa"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] text-[var(--app-text)]"
    >
      <div ref={palco} className="relative md:h-[260vh]">
        {/* `pt-24` no palco grudento não é respiro: a barra é `fixed` e cobre o
            topo da tela, então sem esse recuo a sobrancelha e o título ficam
            ATRÁS dela durante a cena inteira, que é justamente quando o palco
            está colado no topo. */}
        <div className="mx-auto flex max-w-5xl flex-col justify-center px-6 py-28 md:sticky md:top-0 md:h-screen md:px-10 md:pb-10 md:pt-24">
          <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
            <span className="h-px w-7 bg-[var(--app-tint)]/50" />
            Sem sair da conversa
          </p>

          <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-4xl">
            Uma pergunta que vira operação.
          </h2>

          <div className="mt-10 grid items-center gap-10 md:mt-12 md:grid-cols-[auto_1fr] md:gap-14">
            {/* O aparelho é medido pela ALTURA DA TELA, não por uma largura
                fixa, e isso é obrigatório num palco `h-screen`: a moldura é
                9/19,5, então uma largura fixa de 18rem vira 624px de altura e
                estoura um viewport de 720px, cortando a tab bar. Derivando a
                largura de `svh`, o aparelho encolhe junto com a janela e a cena
                nunca é cortada. O teto existe para ele não virar um monólito
                numa tela muito alta. */}
            <div className="mx-auto w-full max-w-[16rem] md:mx-0 md:w-[calc(58svh*9/19.5)] md:max-w-[17rem]">
              <DeviceFrame platform="ios">
                <TelaConversa
                  mensagens={CONVERSA}
                  progresso={dirigido ? suave : undefined}
                  janela={[0.04, 0.92]}
                />
              </DeviceFrame>
            </div>

            {/* Os beats ocupam o MESMO lugar e se revezam. Empilhados, a coluna
                ficaria três vezes mais alta que o telefone e o palco não caberia
                numa tela. */}
            <div className="relative md:min-h-[16rem]">
              {BEATS.map((beat, i) => (
                <Beat
                  key={beat.titulo}
                  beat={beat}
                  indice={i}
                  progresso={suave}
                  animado={dirigido}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Mola do progresso: firme o bastante para não flutuar depois que a roda para. */
const MOLA = { stiffness: 140, damping: 28, mass: 0.5 };

/** Chegada que desacelera até parar, e saída que acelera para fora. */
const CHEGA = cubicBezier(0.22, 1, 0.36, 1);
const SAI = cubicBezier(0.55, 0, 0.75, 0.2);
const PARADO = (v: number) => v;

/**
 * As fatias do progresso em que um beat entra e sai.
 *
 * A entrada termina em `em`. A saída termina ANTES de o próximo terminar de
 * chegar: antes as duas janelas se cruzavam por quase um décimo da cena, e o que
 * se via ali eram dois textos meio transparentes empilhados. O último beat nunca
 * sai, então a saída dele fica além de 1.
 */
export function janelasDoBeat(
  ems: readonly number[],
  indice: number,
): { entra: [number, number]; sai: [number, number] } {
  const em = ems[indice];
  const proximo = ems[indice + 1];
  return {
    entra: [em - 0.09, em],
    sai: proximo === undefined ? [1.5, 1.6] : [proximo - 0.12, proximo - 0.06],
  };
}

/**
 * Entrada e saída de um bloco num revezamento: sobe de baixo desfocando para
 * nítido, fica parado, e sai por cima desfocando de novo. Os quatro pontos são
 * sempre passados, inclusive para quem nunca sai (a saída fica além de 1), para
 * que a contagem de hooks não dependa do índice.
 */
function useRevezamento(
  progresso: MotionValue<number>,
  [a, b, c, d]: [number, number, number, number],
) {
  const pontos = [a, b, c, d];
  const ease = [CHEGA, PARADO, SAI];
  const opacity = useTransform(progresso, pontos, [0, 1, 1, 0], { ease });
  const y = useTransform(progresso, pontos, [36, 0, 0, -28], { ease });
  const desfoque = useTransform(progresso, pontos, [10, 0, 0, 8], { ease });
  const filter = useTransform(desfoque, (v) => `blur(${v.toFixed(2)}px)`);
  return { opacity, y, filter };
}

function Beat({
  beat,
  indice,
  progresso,
  animado,
}: {
  beat: (typeof BEATS)[number];
  indice: number;
  progresso: MotionValue<number>;
  animado: boolean;
}) {
  const { entra, sai } = janelasDoBeat(
    BEATS.map((b) => b.em),
    indice,
  );

  const titulo = useRevezamento(progresso, [...entra, ...sai]);
  // O parágrafo vem um pouco depois do título e sai um pouco antes, o que lê
  // como uma frase sendo dita em vez de um bloco trocando de lugar.
  const corpo = useRevezamento(progresso, [
    entra[0] + 0.025,
    entra[1] + 0.025,
    sai[0] - 0.015,
    sai[1] - 0.015,
  ]);

  return (
    <div
      // Só o primeiro fica no fluxo: ele dá altura à caixa, e os outros se
      // sobrepõem a ele. Sem isso a coluna teria a altura de um beat só quando
      // o segundo entrasse, e o telefone pularia de lugar no meio da cena.
      className={
        indice === 0
          ? "relative"
          : "relative mt-10 md:absolute md:inset-x-0 md:top-0 md:mt-0"
      }
    >
      <motion.h3
        style={animado ? titulo : undefined}
        className="[font-family:var(--font-hanken)] text-2xl font-bold leading-[1.15] tracking-[-0.02em] will-change-transform md:text-[2rem]"
      >
        {beat.titulo}{" "}
        <span className="text-[var(--app-tint)]">{beat.destaque}</span>
      </motion.h3>
      <motion.p
        style={animado ? corpo : undefined}
        className="mt-4 max-w-md text-base leading-relaxed text-[var(--app-text-muted)] will-change-transform"
      >
        {beat.texto}
      </motion.p>
    </div>
  );
}
