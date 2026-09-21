"use client";

import React from "react";
import { m as motion, useTransform } from "motion/react";

import { HidratarPerto } from "@/components/marketing/_shared/hidratar-perto";
import { useScrollProgress } from "@/components/marketing/_shared/use-scroll-progress";

import { COLUNAS, PARES, type ParDeDiferenca } from "../_content/diferenca";

/**
 * A cena que diz, com todas as letras, onde a categoria para.
 *
 * O leitor desce e vê a coluna da esquerda apagar, linha por linha, enquanto a
 * da direita acende. Cada par tem a própria fatia do progresso, como a linha do
 * tempo do site da empresa, então não é uma transição só: é uma leitura, no
 * ritmo de quem está rolando.
 *
 * **Escrita no estado FINAL**, que aqui é a esquerda já apagada e riscada. Sob
 * `prefers-reduced-motion` o `useScrollProgress` devolve `animated: false`,
 * nenhum `style` é aplicado e o que sobra é o markup do servidor; se a cena
 * fosse escrita no estado inicial, quem pediu menos movimento leria as duas
 * colunas com o mesmo peso e a comparação não diria nada.
 *
 * O risco é um elemento de largura cheia SEM classe de transform. Isso não é
 * descuido: no Tailwind v4 um `scale-x-*` compila para a propriedade `scale`,
 * que COMPÕE com `transform` em vez de ser sobrescrita por ele, e o elemento
 * ficaria preso por mais que o `motion` anime. Sem a classe, o estado parado já
 * é `scaleX(1)`, que é exatamente o final que se quer.
 */
export function AplicativoDiferenca() {
  // Margem curta de propósito. Esta é a seção logo abaixo do herói, a 1.368px
  // do topo num celular de 823: com a antecedência padrão (150% da tela) ela
  // já estaria dentro da margem no carregamento e montaria na hora, sem tirar
  // nada da janela que o Lighthouse mede. Com 25% ela monta no primeiro
  // gesto de rolagem, ainda uns 200px antes de aparecer.
  return (
    <HidratarPerto margem="25% 0px">
      <CorpoDaDiferenca />
    </HidratarPerto>
  );
}

function CorpoDaDiferenca() {
  const secao = React.useRef<HTMLDivElement>(null);
  const { progress, animated } = useScrollProgress(secao, {
    start: "top 72%",
    end: "bottom 85%",
    fallback: 1,
  });

  return (
    <section
      id="diferenca"
      className="border-t border-white/[0.06] bg-[var(--app-bg)] px-6 py-28 text-[var(--app-text)] md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--app-tint)]">
          <span className="h-px w-7 bg-[var(--app-tint)]/50" />
          A diferença
        </p>

        <h2 className="max-w-2xl [font-family:var(--font-hanken)] text-3xl font-bold leading-[1.1] tracking-[-0.02em] md:text-5xl">
          A categoria inteira para no primeiro passo.
        </h2>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-[var(--app-text-muted)]">
          Mandar uma mensagem e ver o gasto registrado é onde os outros terminam.
          É onde a ProOps Pessoal começa.
        </p>

        <div ref={secao} className="mt-16 md:mt-20">
          {/* Os rótulos das colunas só existem de `md` para cima: abaixo disso
              cada par já se identifica sozinho, e duas colunas de 160px fariam
              as frases quebrarem palavra por palavra. */}
          <div
            aria-hidden="true"
            className="hidden grid-cols-2 gap-10 border-b border-white/[0.06] pb-4 md:grid"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-muted)]">
              {COLUNAS.eles}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-tint)]">
              {COLUNAS.nos}
            </p>
          </div>

          <ul className="divide-y divide-white/[0.06]">
            {PARES.map((par, indice) => (
              <Par
                key={par.eles}
                par={par}
                indice={indice}
                total={PARES.length}
                progresso={progress}
                animado={animated}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Par({
  par,
  indice,
  total,
  progresso,
  animado,
}: {
  par: ParDeDiferenca;
  indice: number;
  total: number;
  progresso: ReturnType<typeof useScrollProgress>["progress"];
  animado: boolean;
}) {
  // A troca acontece um pouco ANTES de o par chegar ao meio da tela, para o
  // leitor encontrar a linha já resolvida em vez de assistir a ela virando.
  const ponto = (indice + 0.5) / total;
  const de = Math.max(ponto - 0.2, 0);
  const ate = ponto;

  const opacidadeEles = useTransform(progresso, [de, ate], [1, 0.34]);
  const risco = useTransform(progresso, [de, ate], [0, 1]);
  const opacidadeNos = useTransform(progresso, [de, ate], [0.22, 1]);
  const xNos = useTransform(progresso, [de, ate], [14, 0]);

  return (
    <li className="grid gap-4 py-7 md:grid-cols-2 md:gap-10 md:py-8">
      {/* Os rótulos ficam FORA do parágrafo riscado, e isso é a diferença entre
          riscar a frase e riscar o rótulo. O risco é `inset-x-0 top-1/2` do
          elemento que o contém; com o rótulo e um `<br/>` dentro, o meio do
          bloco caía entre as duas linhas e a régua passava por baixo do rótulo,
          sem tocar a frase. Só aparecia no celular, onde o rótulo existe. */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-text-muted)]/70 md:hidden">
          {COLUNAS.eles}
        </p>
        <motion.p
          style={animado ? { opacity: opacidadeEles } : undefined}
          className="relative inline-block text-base leading-relaxed text-[var(--app-text-muted)] opacity-[0.34] md:text-lg"
        >
          {par.eles}
          <motion.span
            aria-hidden="true"
            style={animado ? { scaleX: risco } : undefined}
            className="absolute inset-x-0 top-1/2 block h-px origin-left bg-[var(--app-text-muted)]"
          />
        </motion.p>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-tint)] md:hidden">
          {COLUNAS.nos}
        </p>
        <motion.p
          style={animado ? { opacity: opacidadeNos, x: xNos } : undefined}
          className="text-base font-medium leading-relaxed text-[var(--app-text)] md:text-lg"
        >
          {par.nos}
        </motion.p>
      </div>
    </li>
  );
}
