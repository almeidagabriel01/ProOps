import React from "react";

import { cn } from "@/lib/utils";

interface CabecalhoDaCenaProps {
  /** Só a primeira metade da seção tem sobrancelha. */
  sobrancelha?: string;
  titulo: React.ReactNode;
  texto: string;
  /** A seção tem um `h2`; a segunda metade dela é um `h3`. */
  nivel?: "h2" | "h3";
  /**
   * Dentro de um palco grudado, onde a altura é a da tela, o parágrafo some no
   * celular. Fora dele não há essa disputa, e ele fica.
   */
  compacto?: boolean;
}

/**
 * O título de uma das metades da seção, feito para viver DENTRO do palco
 * grudado.
 *
 * Ele ficava acima do trilho, e com o palco ocupando a tela inteira a pessoa
 * lia o título, rolava, e a partir daí via a cena sem saber mais de que seção
 * ela era. Aqui o título gruda junto e some junto, que é como uma seção se
 * comporta.
 *
 * No palco grudado ele divide a altura da tela com a cena, e por isso o
 * parágrafo some no celular (`compacto`). Numa seção que rola normalmente,
 * não há essa disputa.
 */
export function CabecalhoDaCena({
  sobrancelha,
  titulo,
  texto,
  nivel = "h2",
  compacto = true,
}: CabecalhoDaCenaProps) {
  const Titulo = nivel;
  return (
    <header className="shrink-0">
      {sobrancelha ? (
        <p className="mb-3 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />
          {sobrancelha}
        </p>
      ) : null}
      <Titulo className="max-w-2xl [font-family:var(--font-hanken)] text-2xl font-bold leading-[1.1] tracking-[-0.02em] md:text-4xl">
        {titulo}
      </Titulo>
      <p
        className={cn(
          "mt-3 max-w-xl text-sm leading-relaxed text-[var(--app-text-muted)] md:text-base",
          compacto && "hidden md:block",
        )}
      >
        {texto}
      </p>
    </header>
  );
}
