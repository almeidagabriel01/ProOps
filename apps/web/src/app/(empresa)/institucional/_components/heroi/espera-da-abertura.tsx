"use client";

import React from "react";

import { esperaDaAbertura, useAberturaVaiTocar } from "../abertura-estado";

/**
 * A `<section>` do herói da raiz, com `--espera` escrita nela.
 *
 * Os atrasos da entrada existem para deixar as lâminas da abertura saírem
 * primeiro, e numa volta à raiz por dentro do site a abertura não toca: ali o
 * mesmo atraso vira mais de um segundo de tela parada depois de a cortina já
 * ter subido. A decisão é de cliente (`useAberturaVaiTocar` lê estado de
 * módulo), e é a ÚNICA coisa do herói que precisa ser.
 *
 * Por isso ela é uma variável CSS e não uma prop: todo o resto do herói (texto,
 * desenho, camadas) é componente de servidor e escreve os atrasos como
 * `calc(var(--espera) + …)`. Sem isso, o texto inteiro teria que virar cliente
 * só para somar um número.
 */
export function EsperaDaAbertura({
  children,
  ...props
}: React.ComponentProps<"section">) {
  const espera = esperaDaAbertura(useAberturaVaiTocar());
  return (
    <section
      {...props}
      style={{ ...props.style, "--espera": `${espera}s` } as React.CSSProperties}
    >
      {children}
    </section>
  );
}
