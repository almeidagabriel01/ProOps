"use client";

import React, { useEffect, useState } from "react";

/**
 * Mantém o HTML do servidor e NUNCA o hidrata.
 *
 * É o `HidratarPerto` sem a montagem: serve para markup que é estático por
 * construção e que só é animado por variáveis CSS escritas de fora, como o
 * desenho da casa no herói da raiz. Hidratar um SVG de algumas centenas de nós
 * é trabalho do React por nó, no meio da janela de carga que o Lighthouse mede,
 * para anexar um componente que não tem nada a fazer depois de montado.
 *
 * O mecanismo é o mesmo do `HidratarPerto`, e vale lembrar por que funciona: na
 * hidratação o React não compara o conteúdo de um `dangerouslySetInnerHTML`, e
 * com `suppressHydrationWarning` ele aceita a divergência calado. O DOM que o
 * servidor mandou fica exatamente como veio.
 *
 * Numa navegação pelo cliente não há HTML do servidor para preservar, e aí os
 * filhos são renderizados normalmente. A distinção é o flag de módulo
 * `documentoHidratado`: falso só durante a hidratação do documento.
 */
let documentoHidratado = false;

export function SemHidratar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [preservar] = useState(
    () => typeof window !== "undefined" && !documentoHidratado,
  );

  useEffect(() => {
    documentoHidratado = true;
  }, []);

  if (preservar) {
    return (
      <div
        className={className}
        data-sem-hidratar=""
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />
    );
  }
  return (
    <div className={className} data-sem-hidratar="">
      {children}
    </div>
  );
}
