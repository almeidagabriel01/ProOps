"use client";

import React from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import { cn } from "@/lib/utils";

import { OPERACOES, type Operacao } from "../../_content/comandos";
import { CENAS } from "./cenas";
import { TrocaComSaida } from "./troca-com-saida";
import { useCenaRolada, useProgressoDaFatia } from "./use-cena-rolada";
import { useVisibilidade } from "./use-visibilidade";

const TOTAL = OPERACOES.length;

/** Rolagem de cada operação, em alturas de tela. Os diagramas pedem mais que as frases. */
const FATIA_SVH = 70;

/**
 * A segunda metade da seção: as operações que a categoria não faz, cada uma
 * com o próprio diagrama, desenhado conforme a página desce.
 *
 * Abas de verdade (`tablist`), com as setas do padrão ARIA e o foco
 * acompanhando a seleção. A diferença para abas comuns é que escolher uma leva
 * a PÁGINA até a fatia dela: a rolagem é a única fonte do que está no palco,
 * e é isso que mantém a aba, a barra e o diagrama sempre concordando.
 *
 * Cada aba tem a barra da própria fatia, que enche enquanto o diagrama dela se
 * desenha. No celular a lista vertical não cabe no palco grudado junto com o
 * diagrama, então ela vira seis segmentos no topo, no formato dos Stories, e o
 * pedido aparece dentro do palco.
 *
 * Só a cena ativa existe no DOM. As seis montadas ao mesmo tempo seriam seis
 * árvores com NumberFlow, SVG e timeline para uma ficar visível.
 */
export function MesaDeOperacoes() {
  const { ref: palco, armado } = useVisibilidade<HTMLDivElement>();
  const { trilho, indice, escolher, animado, progresso } = useCenaRolada(TOTAL);
  const idBase = React.useId();
  const abas = React.useRef<(HTMLButtonElement | null)[]>([]);
  const operacao = OPERACOES[indice];

  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const destinos: Record<string, number> = {
      ArrowDown: Math.min(indice + 1, TOTAL - 1),
      ArrowRight: Math.min(indice + 1, TOTAL - 1),
      ArrowUp: Math.max(indice - 1, 0),
      ArrowLeft: Math.max(indice - 1, 0),
      Home: 0,
      End: TOTAL - 1,
    };
    if (!(evento.key in destinos)) return;
    evento.preventDefault();
    const destino = destinos[evento.key];
    escolher(destino);
    abas.current[destino]?.focus({ preventScroll: true });
  }

  return (
    <div
      ref={trilho}
      style={
        animado
          ? { height: `calc(100svh + ${TOTAL * FATIA_SVH}svh)` }
          : undefined
      }
      className="relative"
    >
      <div
        ref={palco}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-center md:gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-14",
          animado &&
            "sticky top-0 h-[100svh] content-start pt-24 md:content-center",
        )}
      >
        <div
          role="tablist"
          aria-label="Operações de exemplo"
          aria-orientation="vertical"
          onKeyDown={aoTeclar}
          className="order-1 grid grid-cols-6 gap-1.5 md:flex md:flex-col md:gap-0"
        >
          {OPERACOES.map((item, i) => (
            <Aba
              key={item.cena}
              ref={(el) => {
                abas.current[i] = el;
              }}
              item={item}
              indice={i}
              ativa={i === indice}
              idBase={idBase}
              progresso={animado ? progresso : undefined}
              aoEscolher={() => escolher(i)}
            />
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${idBase}-painel`}
          aria-labelledby={`${idBase}-aba-${indice}`}
          className="order-2"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-[var(--app-card-border)] bg-[linear-gradient(180deg,var(--app-hero-top),var(--app-bg))] p-5 shadow-[0_50px_100px_-60px_rgba(0,0,0,0.95)] md:p-8">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-[var(--app-tint)] opacity-[0.08] blur-[80px]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)]"
            />

            <p className="relative [font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-tint)]">
              {operacao.pedido}
            </p>

            {/* Altura fixa, para o palco não pular entre cenas: a da cena mais
                alta em cada largura, que no celular é a fatia da fatura, com
                a lista e o limite empilhados. */}
            <div className="relative mt-5 h-[27rem] md:mt-8 md:h-[22rem] lg:h-[24rem]">
              <TrocaComSaida valor={indice} chave={String} className="h-full">
                {(exibida) => (
                  <CenaNaFatia
                    indice={exibida}
                    progresso={progresso}
                    animado={animado}
                    armado={armado}
                  />
                )}
              </TrocaComSaida>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--app-text-muted)] md:text-base">
            {operacao.efeito}
          </p>
        </div>
      </div>
    </div>
  );
}

function CenaNaFatia({
  indice,
  progresso,
  animado,
  armado,
}: {
  indice: number;
  progresso: MotionValue<number>;
  animado: boolean;
  armado: boolean;
}) {
  const daFatia = useProgressoDaFatia(progresso, indice, TOTAL, animado);
  const Cena = CENAS[OPERACOES[indice].cena];
  return <Cena armado={armado} progresso={daFatia} />;
}

interface AbaProps {
  item: Operacao;
  indice: number;
  ativa: boolean;
  idBase: string;
  /** Ausente no modo sem rolagem: a barra fica cheia na aba ativa. */
  progresso?: MotionValue<number>;
  aoEscolher: () => void;
  ref: React.Ref<HTMLButtonElement>;
}

/**
 * Uma aba. No celular é só o segmento (o texto do pedido está no palco, e o
 * nome acessível continua sendo o pedido); de `md` para cima, o pedido com a
 * barra da fatia embaixo.
 */
function Aba({
  item,
  indice,
  ativa,
  idBase,
  progresso,
  aoEscolher,
  ref,
}: AbaProps) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${idBase}-aba-${indice}`}
      aria-selected={ativa}
      aria-controls={`${idBase}-painel`}
      aria-label={item.pedido}
      tabIndex={ativa ? 0 : -1}
      onClick={aoEscolher}
      className={cn(
        "group relative flex flex-col justify-center py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-tint)]/60 md:py-4",
        ativa
          ? "text-[var(--app-text)]"
          : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]",
      )}
    >
      <span className="hidden text-base leading-snug md:block">
        {item.pedido}
      </span>
      <BarraDaFatia
        indice={indice}
        ativa={ativa}
        progresso={progresso}
        className="md:mt-3"
      />
    </button>
  );
}

function BarraDaFatia({
  indice,
  ativa,
  progresso,
  className,
}: {
  indice: number;
  ativa: boolean;
  progresso?: MotionValue<number>;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block h-[3px] overflow-hidden rounded-full bg-[var(--app-text)]/[0.1] md:h-px",
        className,
      )}
    >
      {progresso ? (
        <PreenchimentoRolado indice={indice} progresso={progresso} />
      ) : (
        <span
          className={cn(
            "block h-full origin-left bg-[var(--app-tint)]",
            ativa ? "scale-x-100" : "scale-x-0",
          )}
        />
      )}
    </span>
  );
}

/** A barra de uma fatia enche do começo dela até o fim da SUA animação. */
function PreenchimentoRolado({
  indice,
  progresso,
}: {
  indice: number;
  progresso: MotionValue<number>;
}) {
  const escala = useTransform(progresso, (v) =>
    Math.min(Math.max(v * TOTAL - indice, 0), 1),
  );
  return (
    <motion.span
      style={{ scaleX: escala }}
      className="block h-full origin-left bg-[var(--app-tint)]"
    />
  );
}
