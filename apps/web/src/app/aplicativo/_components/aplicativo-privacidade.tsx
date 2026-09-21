"use client";

import React from "react";
import gsap from "gsap";

import { useHolofote } from "@/components/marketing/_shared/use-holofote";
import {
  CENA_REPETE,
  SCENE_ANY_WIDTH,
  useScrollScene,
} from "@/components/marketing/_shared/use-scroll-scene";
import { APP_NAME } from "@/lib/site/app-brand";

/**
 * O único ângulo em que ficar de fora do Open Finance é vantagem.
 *
 * Quatro dos cinco concorrentes diretos vendem conexão bancária ("114 bancos",
 * "regulado pelo Bacen") e gastam uma seção inteira com isso. A ProOps Pessoal
 * não conecta banco nenhum, e essa é uma diferença real que pode ser dita de dois
 * jeitos. Dita como recurso que falta, ela perde. Dita como o que de fato é, ela
 * é a única coisa nesta categoria que nenhum deles pode afirmar: aqui ninguém
 * pede a senha do seu banco.
 *
 * A seção existe também porque a pergunta "conecta com o meu banco?" ia ficar
 * sem resposta em lugar nenhum da página, e pergunta sem resposta numa landing
 * de produto financeiro não some: ela vira objeção silenciosa.
 *
 * **Tudo aqui é verificável no repositório do aplicativo**, e nada é adjetivo:
 * Meta Cloud API oficial e nunca cliente não-oficial (`.claude/rules/whatsapp.md`),
 * HMAC sobre o corpo cru antes de qualquer parse (`app/security.py`), RLS
 * deny-by-default em todas as tabelas, e o portão de confirmação antes do que é
 * difícil de desfazer. Não acrescente linha aqui que não tenha um arquivo atrás.
 */

const GARANTIAS = [
  {
    titulo: "A porta é a oficial",
    texto:
      "WhatsApp pela Meta Cloud API, nunca por cliente não-oficial. Cliente não-oficial é conta banida e conversa passando por um intermediário que ninguém auditou.",
  },
  {
    titulo: "Toda mensagem é assinada",
    texto:
      "A assinatura do webhook é conferida sobre o corpo cru, antes de qualquer leitura. Sem assinatura válida, a mensagem não chega a existir.",
  },
  {
    titulo: "Seus dados são só seus",
    texto:
      "O banco nega tudo por padrão e cada linha é liberada pelo dono dela. Não existe consulta que atravesse de uma conta para outra.",
  },
  {
    titulo: "O irreversível espera",
    texto:
      "Apagar, pagar uma fatura ou lançar um valor alto vira uma pendência que aguarda o seu sim, e some sozinha se você não responder.",
  },
];

export function AplicativoPrivacidade() {
  const secao = React.useRef<HTMLElement>(null);
  const grade = useHolofote<HTMLDivElement>();

  useScrollScene(
    secao,
    () => {
      const celulas = gsap.utils.toArray<HTMLElement>(".garantia-card");
      if (!celulas.length) return;
      const tween = gsap.fromTo(
        celulas,
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "expo.out",
          stagger: 0.07,
          scrollTrigger: {
            trigger: grade.current,
            start: "top 88%",
            toggleActions: CENA_REPETE,
          },
        },
      );
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { query: SCENE_ANY_WIDTH },
  );

  return (
    <section
      ref={secao}
      id="privacidade"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />O que a gente não
          pede
        </p>

        <div className="grid gap-12 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-16">
          <div>
            <h2 className="[font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
              Não pedimos a senha
              <br />
              <span className="text-[var(--app-tint)]">do seu banco.</span>
            </h2>

            <p className="mt-7 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)] md:text-lg">
              Porque a gente não entra nele. O que a {APP_NAME} sabe é o que
              você contou, e nada além disso.
            </p>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)]">
              Quando quiser trazer o mês inteiro de uma vez, importe o extrato
              em OFX ou CSV. O arquivo é seu, e é você que entrega.
            </p>
          </div>

          <DiagramaSemBanco />
        </div>

        <div
          ref={grade}
          className="mt-16 grid gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-4"
        >
          {GARANTIAS.map((garantia) => (
            <article
              key={garantia.titulo}
              data-holofote
              className="garantia-card holofote relative overflow-hidden rounded-3xl border border-[var(--app-card-border)] bg-[var(--app-surface)] p-6 md:p-7"
            >
              <h3 className="relative [font-family:var(--font-hanken)] text-base font-semibold leading-snug">
                {garantia.titulo}
              </h3>
              <p className="relative mt-3 text-sm leading-relaxed text-[var(--app-text-muted)]">
                {garantia.texto}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * O caminho que o dado faz, e o que ele não faz.
 *
 * Animado por CSS (`.traco-desenha`), como as assinaturas dos heróis do site da
 * empresa, e não por `motion`: é um desenho de apoio, e a classe já declara o
 * estado final sob `prefers-reduced-motion`, então o traço aparece inteiro para
 * quem pediu menos movimento em vez de invisível.
 *
 * Todo traço animado declara `pathLength={1}`, senão o `stroke-dasharray: 1` da
 * classe teria que ser o comprimento real do caminho.
 *
 * O texto tem tamanho MAIOR abaixo de `md`, e isso não é um descuido
 * invertido: o desenho tem 460 de largura e encolhe junto com a coluna, então
 * num celular de 360 ele é desenhado a 0,68. Os 11px do rodapé viravam 7,5px
 * na tela, e os 15px das caixas, 10px. Nos tamanhos daqui, o que a pessoa lê
 * fica perto dos 11 e dos 14 reais nas duas pontas.
 */
function DiagramaSemBanco() {
  return (
    <svg
      viewBox="0 0 460 300"
      className="w-full"
      role="img"
      aria-label="Você fala com a ProOps Pessoal; a ProOps Pessoal não se conecta ao seu banco."
    >
      <Caixa x={10} y={26} largura={150} altura={58} rotulo="Você" atraso={0} />

      <path
        d="M168 55 H282"
        pathLength={1}
        className="traco-desenha"
        style={{ "--traco-delay": "0.35s" } as React.CSSProperties}
        stroke="var(--app-tint)"
        strokeWidth={1.5}
        fill="none"
      />
      <path
        d="M276 50 L284 55 L276 60 Z"
        fill="var(--app-tint)"
        className="pulso-no"
      />

      <Caixa
        x={290}
        y={26}
        largura={160}
        altura={58}
        rotulo="ProOps Pessoal"
        atraso={0.55}
        acesa
      />

      {/* A ligação que não existe. Tracejada, e cortada por um X no meio. */}
      <path
        d="M370 92 V196"
        pathLength={1}
        className="traco-desenha"
        style={{ "--traco-delay": "0.9s" } as React.CSSProperties}
        stroke="var(--app-separator)"
        strokeWidth={1.5}
        strokeDasharray="1"
        fill="none"
        opacity={0.5}
      />
      <g
        className="traco-desenha"
        style={{ "--traco-delay": "1.25s" } as React.CSSProperties}
        stroke="var(--app-danger)"
        strokeWidth={1.8}
        strokeLinecap="round"
      >
        <path d="M361 135 L379 153" pathLength={1} />
        <path d="M379 135 L361 153" pathLength={1} />
      </g>

      <Caixa
        x={290}
        y={204}
        largura={160}
        altura={58}
        rotulo="Seu banco"
        atraso={1.05}
        apagada
      />

      <text
        x={10}
        y={222}
        className="[font-family:var(--font-jetbrains-mono)] text-[16px] md:text-[11px]"
        fill="var(--app-text-muted)"
      >
        sem credencial,
      </text>
      <text
        x={10}
        y={240}
        className="[font-family:var(--font-jetbrains-mono)] text-[16px] md:text-[11px]"
        fill="var(--app-text-muted)"
      >
        sem leitura de conta,
      </text>
      <text
        x={10}
        y={258}
        className="[font-family:var(--font-jetbrains-mono)] text-[16px] md:text-[11px]"
        fill="var(--app-text-muted)"
      >
        sem Open Finance.
      </text>
    </svg>
  );
}

function Caixa({
  x,
  y,
  largura,
  altura,
  rotulo,
  atraso,
  acesa = false,
  apagada = false,
}: {
  x: number;
  y: number;
  largura: number;
  altura: number;
  rotulo: string;
  atraso: number;
  acesa?: boolean;
  apagada?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={largura}
        height={altura}
        rx={14}
        fill="none"
        pathLength={1}
        className="traco-desenha"
        style={{ "--traco-delay": `${atraso}s` } as React.CSSProperties}
        stroke={acesa ? "var(--app-tint)" : "var(--app-separator)"}
        strokeWidth={1.5}
        opacity={apagada ? 0.45 : 1}
      />
      <text
        x={x + largura / 2}
        y={y + altura / 2 + 5}
        textAnchor="middle"
        className="[font-family:var(--font-hanken)] text-[21px] font-semibold md:text-[15px]"
        fill={acesa ? "var(--app-tint)" : "var(--app-text)"}
        opacity={apagada ? 0.45 : 1}
      >
        {rotulo}
      </text>
    </g>
  );
}
