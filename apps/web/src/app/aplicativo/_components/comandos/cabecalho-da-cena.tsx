import React from "react";

interface CabecalhoDaCenaProps {
  /** Só a primeira metade da seção tem sobrancelha. */
  sobrancelha?: string;
  titulo: React.ReactNode;
  texto: string;
  /** A seção tem um `h2`; a segunda metade dela é um `h3`. */
  nivel?: "h2" | "h3";
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
 * Compacto de propósito: no palco ele divide a altura da tela com a cena, e o
 * parágrafo some no celular, onde não sobra altura para ele.
 */
export function CabecalhoDaCena({
  sobrancelha,
  titulo,
  texto,
  nivel = "h2",
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
      <p className="mt-3 hidden max-w-xl text-base leading-relaxed text-[var(--app-text-muted)] md:block">
        {texto}
      </p>
    </header>
  );
}
