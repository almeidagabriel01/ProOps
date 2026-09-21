"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";
import { MolduraNavegador } from "@/components/marketing/_shared/moldura-navegador";
import { cn } from "@/lib/utils";

interface Tela {
  arquivo: string;
  rotulo: string;
  titulo: string;
  texto: string;
  alt: string;
}

/**
 * Real captures, from `public/hero`, already in the repo and already used by the
 * ERP landing. Not renders and not a designer's idea of the product: the point
 * of this section is that the reader sees the thing they would be buying.
 */
const TELAS: Tela[] = [
  {
    arquivo: "/hero/Dashboard.png",
    rotulo: "Dashboard",
    titulo: "O mês inteiro numa tela",
    texto:
      "Saldo, fluxo de caixa, propostas em aberto e o que entrou de cliente novo. É a primeira tela do dia, e ela existe para não precisar de uma segunda.",
    alt: "Dashboard do ERP da ProOps, com saldo, fluxo de caixa e propostas recentes",
  },
  {
    arquivo: "/hero/Kanban.png",
    rotulo: "CRM",
    titulo: "Onde cada negócio parou",
    texto:
      "O funil por etapa, com a proposta e o histórico do cliente no mesmo cartão. Arrastar muda o estágio, e o financeiro sabe disso.",
    alt: "Funil de vendas do ERP da ProOps, em formato kanban",
  },
  {
    arquivo: "/hero/Carteira.png",
    rotulo: "Financeiro",
    titulo: "Quanto entrou, quanto falta",
    texto:
      "Carteiras separadas, pago e pendente já divididos, e o acréscimo lançado no lugar certo sem redigitar o que a proposta já sabia.",
    alt: "Tela de carteiras e lançamentos financeiros do ERP da ProOps",
  },
  {
    arquivo: "/hero/PDF.png",
    rotulo: "Propostas",
    titulo: "A proposta que o cliente recebe",
    texto:
      "PDF com a sua marca, montado a partir do orçamento e entregue na pasta do cliente no Drive. Sem exportar, sem montar de novo.",
    alt: "Editor de PDF de proposta do ERP da ProOps",
  },
];

const INICIO = 0.08;
const FIM = 0.92;

/**
 * The ERP, four screens, driven by the scroll.
 *
 * The products page was a wall of prose: two columns of copy claiming a system
 * exists. Four real captures, swapped under one browser window as the reader
 * descends, is the same argument made by showing instead of telling, and it
 * costs no new asset because the ERP landing already ships these files.
 *
 * One window that changes contents, not four windows in a row: the frame staying
 * put is what makes the swap read as navigating a product rather than as
 * scrolling past a gallery.
 *
 * Under `prefers-reduced-motion` the whole thing un-stacks into a plain vertical
 * list of four captioned screenshots, which is the same information at the same
 * reading order.
 */
export function TelasDoErp() {
  const trilha = useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(trilha, { fallback: 1 });

  if (!animated) {
    return (
      <div ref={trilha} className="space-y-16">
        {TELAS.map((tela) => (
          <div key={tela.arquivo}>
            <MolduraNavegador>
              <Captura tela={tela} />
            </MolduraNavegador>
            <div className="mt-6 max-w-xl">
              <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.22em] text-white/40">
                {tela.rotulo}
              </p>
              <h3 className="mt-3 [font-family:var(--font-bricolage)] text-2xl font-semibold tracking-tight text-white">
                {tela.titulo}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-white/60">
                {tela.texto}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={trilha}
      className="relative"
      style={{ height: `${(TELAS.length + 1) * 100}vh` }}
    >
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.8fr_1.45fr] lg:gap-16">
          {/* The copy column. Each entry occupies the same box and only one is
              lit, so the window beside it never has to move to make room. */}
          <div className="relative min-h-[15rem] md:min-h-[16rem]">
            {TELAS.map((tela, index) => (
              <Legenda
                key={tela.arquivo}
                tela={tela}
                indice={index}
                total={TELAS.length}
                progresso={progress}
              />
            ))}
          </div>

          <div className="relative">
            <MolduraNavegador>
              {/* Every capture is mounted and only the active one is opaque.
                  Mounting on demand would decode a 500KB PNG mid-scroll, and the
                  swap would stutter exactly where it is being watched. */}
              {/* Proporção do arquivo (1920x944). Ver a nota em page.tsx: uma
                  caixa mais estreita corta a coluna da esquerda da captura. */}
              <div className="relative aspect-[1920/944]">
                {TELAS.map((tela, index) => (
                  <Camada
                    key={tela.arquivo}
                    tela={tela}
                    indice={index}
                    total={TELAS.length}
                    progresso={progress}
                    prioridade={index === 0}
                  />
                ))}
              </div>
            </MolduraNavegador>

            <Trilha progresso={progress} total={TELAS.length} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Where a screen's slice of the travel starts and ends. */
function fatiaDe(indice: number, total: number) {
  const largura = (FIM - INICIO) / total;
  const de = INICIO + indice * largura;
  return { de, ate: de + largura, meio: largura * 0.2 };
}

function Captura({ tela, prioridade }: { tela: Tela; prioridade?: boolean }) {
  return (
    <Image
      src={tela.arquivo}
      alt={tela.alt}
      fill
      sizes="(min-width: 1024px) 46rem, 92vw"
      priority={prioridade}
      className="object-cover"
    />
  );
}

function Camada({
  tela,
  indice,
  total,
  progresso,
  prioridade,
}: {
  tela: Tela;
  indice: number;
  total: number;
  progresso: MotionValue<number>;
  prioridade: boolean;
}) {
  const { de, ate, meio } = fatiaDe(indice, total);
  const primeiro = indice === 0;
  const ultimo = indice === total - 1;

  // Sequential, not a cross-fade: two screenshots at half opacity on top of each
  // other is a smear, and both are dense UI. The first is already up when the
  // stage arrives and the last is still up when it leaves, for the same reason
  // every scene here does that — a sticky stage holds the viewport for a whole
  // screen on either side of its trigger.
  const entrada = primeiro ? [0] : [de, de + meio];
  const saida = ultimo ? [1] : [ate - meio, ate];
  const opacity = useTransform(
    progresso,
    [...entrada, ...saida],
    [...(primeiro ? [1] : [0, 1]), ...(ultimo ? [1] : [1, 0])],
  );
  const scale = useTransform(
    progresso,
    [...entrada, ...saida],
    [...(primeiro ? [1] : [1.03, 1]), ...(ultimo ? [1] : [1, 1.02])],
  );

  return (
    <motion.div style={{ opacity, scale }} className="absolute inset-0">
      <Captura tela={tela} prioridade={prioridade} />
    </motion.div>
  );
}

function Legenda({
  tela,
  indice,
  total,
  progresso,
}: {
  tela: Tela;
  indice: number;
  total: number;
  progresso: MotionValue<number>;
}) {
  const { de, ate, meio } = fatiaDe(indice, total);
  const primeiro = indice === 0;
  const ultimo = indice === total - 1;

  const entrada = primeiro ? [0] : [de, de + meio];
  const saida = ultimo ? [1] : [ate - meio, ate];
  const opacity = useTransform(
    progresso,
    [...entrada, ...saida],
    [...(primeiro ? [1] : [0, 1]), ...(ultimo ? [1] : [1, 0])],
  );
  const y = useTransform(
    progresso,
    [...entrada, ...saida],
    [...(primeiro ? [0] : [26, 0]), ...(ultimo ? [0] : [0, -26])],
  );

  return (
    <motion.div style={{ opacity, y }} className="absolute inset-x-0 top-0">
      <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] tabular-nums text-white/40">
        {String(indice + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        <span className="mx-3 text-white/20">·</span>
        {tela.rotulo}
      </p>
      <h3 className="mt-6 [font-family:var(--font-bricolage)] text-[clamp(1.75rem,3.4vw,2.75rem)] font-semibold leading-tight tracking-[-0.03em] text-white">
        {tela.titulo}
      </h3>
      <p className="mt-5 max-w-md text-base leading-relaxed text-white/60">
        {tela.texto}
      </p>
    </motion.div>
  );
}

/** One segment per screen, so a window that keeps changing still has a length. */
function Trilha({
  progresso,
  total,
}: {
  progresso: MotionValue<number>;
  total: number;
}) {
  return (
    <div aria-hidden="true" className="mt-6 flex gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <Segmento
          key={index}
          indice={index}
          total={total}
          progresso={progresso}
        />
      ))}
    </div>
  );
}

function Segmento({
  indice,
  total,
  progresso,
}: {
  indice: number;
  total: number;
  progresso: MotionValue<number>;
}) {
  const { de, ate } = fatiaDe(indice, total);
  const escala = useTransform(progresso, [de, ate], [0, 1]);

  return (
    <div className={cn("h-px flex-1 bg-white/12")}>
      <motion.div
        style={{ scaleX: escala }}
        className="h-px w-full origin-left bg-white/70"
      />
    </div>
  );
}
