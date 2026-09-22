"use client";

import React, { useRef, useState } from "react";
import { m as motion, useMotionValue, useSpring, useTransform } from "motion/react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { cn } from "@/lib/utils";

import {
  CONTRAPARTIDAS,
  PRINCIPIOS,
} from "@/app/(empresa)/institucional/_content/institucional-copy";

/** O quanto a viga pende, no máximo, em graus. */
const INCLINACAO = 6;

/**
 * A mola da viga. Pouco amortecida de propósito: uma balança de verdade passa
 * do ponto e volta antes de assentar, e é esse vaivém que faz a peça parecer
 * ter peso, em vez de um ponteiro de instrumento.
 */
const MOLA = { stiffness: 110, damping: 11, mass: 1.25 };

/**
 * O herói de /manifesto: "o que decide o produto", como uma balança.
 *
 * Num prato, os três princípios; no outro, as três contrapartidas, cada uma o
 * preço do princípio de mesma posição (`CONTRAPARTIDAS` segue a ordem de
 * `PRINCIPIOS`, e o comentário de lá diz por quê). É a tese da página inteira:
 * cada escolha tem um peso do outro lado, e a página é honesta sobre os dois.
 *
 * A viga pende para o lado do ponteiro, numa mola. Apontar um item pesa o
 * prato dele e acende o par do outro lado, que é a leitura que interessa:
 * "Software que cabe no dia" custa "Demonstração mais bonita".
 *
 * O primeiro paint é CSS: a balança nivelada, e uma entrada (`.balanca-assenta`)
 * que a deixa cair e assentar. A mola do JavaScript fica num elemento DE DENTRO
 * daquele, porque uma animação CSS e um transform inline no mesmo elemento
 * brigam, e a animação vence. Sob movimento reduzido não há mola nem ponteiro:
 * a balança fica nivelada, e os dois pratos, legíveis.
 *
 * `aria-hidden` inteira: o que ela diz está em texto logo abaixo, nas seções de
 * cada princípio e na "A contrapartida", que são as donas do assunto.
 */
export function HeroiBalanca() {
  const reduzido = useReducedMotion();
  const area = useRef<HTMLDivElement>(null);
  const alvo = useMotionValue(0);
  const angulo = useSpring(alvo, MOLA);
  const contra = useTransform(angulo, (a) => -a);
  const [par, setPar] = useState<number | null>(null);

  const aoMover = (evento: React.PointerEvent) => {
    if (reduzido || evento.pointerType !== "mouse" || par !== null) return;
    const caixa = area.current?.getBoundingClientRect();
    if (!caixa) return;
    const relativo = (evento.clientX - caixa.left) / caixa.width - 0.5;
    alvo.set(Math.max(-1, Math.min(1, relativo * 2)) * INCLINACAO * 0.6);
  };

  const escolhe = (indice: number | null, lado: "principio" | "custo" | null) => {
    setPar(indice);
    if (reduzido) return;
    alvo.set(lado === "principio" ? -INCLINACAO : lado === "custo" ? INCLINACAO : 0);
  };

  const prato = (lado: "principio" | "custo") => {
    const itens = lado === "principio" ? PRINCIPIOS.map((p) => p.titulo) : CONTRAPARTIDAS.map((c) => c.curto);
    return (
      <motion.div
        style={reduzido ? undefined : { rotate: contra }}
        className={cn(
          "absolute top-0 w-[10rem] origin-top sm:w-[15rem] md:w-[17rem]",
          lado === "principio" ? "left-0 -ml-[5rem] sm:-ml-[7.5rem] md:-ml-[8.5rem]" : "right-0 -mr-[5rem] sm:-mr-[7.5rem] md:-mr-[8.5rem]",
        )}
      >
        {/* Os dois fios, até as bordas do prato. */}
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-10 w-full md:h-14" fill="none">
          <path
            className="traco-desenha"
            pathLength={1}
            d="M50 0L8 40M50 0L92 40"
            stroke="rgb(var(--linha) / 0.45)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
            style={{ "--traco-delay": "0.55s", "--traco-dur": "0.8s" } as React.CSSProperties}
          />
        </svg>
        <div className="h-px w-full bg-white/30" />
        <p className="mt-3 text-[11px] text-white/45 sm:text-xs">
          {lado === "principio" ? "O que a gente escolhe" : "O que isso custa"}
        </p>
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {itens.map((texto, i) => {
            const aceso = par === i;
            return (
              <li
                key={texto}
                onPointerEnter={(e) => e.pointerType === "mouse" && escolhe(i, lado)}
                onPointerLeave={(e) => e.pointerType === "mouse" && escolhe(null, null)}
                onClick={() => escolhe(par === i ? null : i, par === i ? null : lado)}
                className={cn(
                  "balanca-item hero-enter cursor-pointer rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] leading-snug transition-[background-color,border-color,color] duration-300 sm:text-[13px] md:text-sm",
                  lado === "principio"
                    ? "border-white/15 bg-white/[0.06] text-white"
                    : "border-dashed border-white/15 text-white/60",
                  aceso && lado === "principio" && "border-[rgb(var(--tungstenio)/0.7)] bg-[rgb(var(--tungstenio)/0.14)]",
                  aceso && lado === "custo" && "border-[rgb(var(--tungstenio)/0.55)] text-white",
                )}
                style={
                  {
                    "--hero-y": "10px",
                    "--hero-delay": `${0.75 + i * 0.08 + (lado === "custo" ? 0.12 : 0)}s`,
                  } as React.CSSProperties
                }
              >
                {texto}
              </li>
            );
          })}
        </ul>
      </motion.div>
    );
  };

  return (
    <div
      ref={area}
      aria-hidden="true"
      onPointerMove={aoMover}
      onPointerLeave={() => par === null && alvo.set(0)}
      className="relative mx-auto w-full max-w-4xl select-none pb-4 pt-2"
    >
      <div className="balanca-assenta relative mx-auto h-[15rem] w-[62%] sm:h-[16rem] md:h-[17.5rem]">
        <motion.div
          style={reduzido ? undefined : { rotate: angulo }}
          className="absolute inset-x-0 top-6 h-px origin-center"
        >
          <div className="regua-desenha h-[1.5px] w-full bg-white/55" style={{ "--regua-delay": "0.2s" } as React.CSSProperties} />
          <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-[var(--noite)]" />
          {prato("principio")}
          {prato("custo")}
        </motion.div>

        {/* O fiel, parado: é a única peça que não se mexe, e é isso que faz a
            viga parecer girar em torno de alguma coisa. */}
        <svg
          viewBox="0 0 40 120"
          className="absolute left-1/2 top-6 h-[11rem] w-8 -translate-x-1/2 md:h-[12.5rem]"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            className="traco-desenha"
            pathLength={1}
            d="M20 0V112M4 118H36"
            stroke="rgb(var(--linha) / 0.5)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
            style={{ "--traco-delay": "0.1s", "--traco-dur": "0.9s" } as React.CSSProperties}
          />
        </svg>
      </div>
    </div>
  );
}
