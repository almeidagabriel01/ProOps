"use client";

import React, { createContext, useContext, useRef } from "react";
import { m as motion, useTransform, type MotionValue } from "motion/react";

import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";

interface Saida {
  progresso: MotionValue<number>;
  animado: boolean;
}

const SaidaContext = createContext<Saida | null>(null);

/**
 * A `<section>` do herói de uma sub-página, com o progresso de SAÍDA dela.
 *
 * É o único pedaço de JavaScript do primitivo, e existe para uma coisa: sair do
 * herói ser um movimento e não um corte. O progresso é medido de `top top` a
 * `bottom top`, ou seja, a partir do instante em que a seção começa a ir
 * embora, porque ela é a primeira coisa da página e já entrou.
 *
 * Os filhos continuam sendo componentes de servidor; quem lê o progresso é o
 * `SaiComARolagem`, pelo contexto.
 */
export function HeroiSecao({
  rotulo,
  className,
  children,
}: {
  rotulo: string;
  className?: string;
  children: React.ReactNode;
}) {
  const secao = useRef<HTMLElement>(null);
  const { progress, animated } = useScrollProgress(secao, {
    start: "top top",
    end: "bottom top",
    fallback: 0,
  });

  return (
    <SaidaContext.Provider value={{ progresso: progress, animado: animated }}>
      <section ref={secao} aria-label={rotulo} className={className}>
        {children}
      </section>
    </SaidaContext.Provider>
  );
}

/**
 * Um bloco que se afasta enquanto o herói sai.
 *
 * `copia` sobe e apaga; `cena` desce um pouco e cresce, em sentido contrário, o
 * que dá profundidade sem nenhuma camada a mais. Sob movimento reduzido o
 * `style` nem é aplicado: o bloco fica exatamente como o servidor o escreveu.
 *
 * O transform vai NESTE elemento, e as entradas CSS (`.hero-enter`) ficam nos
 * filhos: uma animação CSS vence o estilo inline na cascata, então os dois no
 * mesmo elemento fariam a entrada apagar a saída.
 */
export function SaiComARolagem({
  papel,
  className,
  children,
}: {
  papel: "copia" | "cena" | "ficha";
  className?: string;
  children: React.ReactNode;
}) {
  const saida = useContext(SaidaContext);
  if (!saida) throw new Error("SaiComARolagem precisa estar dentro de HeroiSecao");
  const { progresso, animado } = saida;
  const y = useTransform(
    progresso,
    [0, 1],
    papel === "copia" ? ["0%", "-18%"] : papel === "cena" ? ["0%", "10%"] : ["0%", "0%"],
  );
  const escala = useTransform(progresso, [0, 1], [1, papel === "cena" ? 1.08 : 1]);
  const opacidade = useTransform(progresso, [0, 0.75], [1, papel === "cena" ? 0.35 : 0]);

  return (
    <motion.div
      style={animado ? { y, scale: escala, opacity: opacidade } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  );
}
