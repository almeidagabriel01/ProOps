import React from "react";

import { cn } from "@/lib/utils";

/**
 * O `<h1>` de um herói, com as linhas explícitas.
 *
 * As linhas são decididas por quem chama, num array de `LinhaHero`, e não pelo
 * SplitText: a subida por linha precisa que as caixas das linhas existam antes
 * de a animação começar, e o SplitText as calcula a partir do layout, que numa
 * página com a fonte ainda carregando quebra diferente do que o leitor acaba
 * vendo. Linha explícita também é copy editável.
 */
export function HeroiTitulo({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "[font-family:var(--font-bricolage)] text-[clamp(2.7rem,7.4vw,5.75rem)] font-extrabold leading-[0.94] tracking-[-0.045em] text-white",
        className,
      )}
    >
      {children}
    </h1>
  );
}

/**
 * Uma linha do título, subindo de uma base recortada.
 *
 * O recorte é `clip-path` e não `overflow-hidden`, por causa do EIXO. A subida é
 * vertical, mas `overflow` corta nos quatro lados, e a caixa de uma linha tem a
 * largura exata do avanço dos glifos: a ponta de um "f" ou de um "j" que passa
 * da caixa era decepada reto. `inset(0 -12px)` corta em cima e embaixo e deixa
 * folga dos lados. Não dá para pedir isso com `overflow`: mexer num eixo só faz
 * o outro virar `auto`.
 *
 * O `pb` embaixo é o que salva os descendentes (o "p" de "projeto", o "g" de
 * "gestão") do corte de baixo, e a margem negativa devolve esse espaço à linha
 * para o bloco não ficar mais alto que o tipo.
 *
 * A estrutura tem três níveis, e o E2E do site mede exatamente ela: o recorte, a
 * `.hero-rise-line` que sobe e um filho que carrega o texto.
 */
export function LinhaHero({
  children,
  atraso = 0,
  className,
}: {
  children: React.ReactNode;
  /** Em segundos, ou uma expressão CSS de tempo (`calc(var(--espera) + .1s)`). */
  atraso?: number | string;
  className?: string;
}) {
  return (
    <span className={cn("-mb-[0.16em] block pb-[0.18em] [clip-path:inset(0_-12px)]", className)}>
      <span
        className="hero-rise-line"
        style={
          {
            // A primeira linha começa em ZERO. Chegando por cortina, a entrada
            // é destravada no instante em que o painel sai, e qualquer atraso
            // aqui vira página parada antes de a primeira coisa se mexer.
            "--hero-delay": typeof atraso === "number" ? `${atraso}s` : atraso,
            "--hero-dur": "0.95s",
          } as React.CSSProperties
        }
      >
        <span className="inline-block">{children}</span>
      </span>
    </span>
  );
}
