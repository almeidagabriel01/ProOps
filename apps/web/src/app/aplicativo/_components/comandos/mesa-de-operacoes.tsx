"use client";

import React from "react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { cn } from "@/lib/utils";

import { OPERACOES, type Operacao } from "../../_content/comandos";
import { CENAS } from "./cenas";
import { TrocaComSaida } from "./troca-com-saida";
import { useVisibilidade } from "./use-visibilidade";

const TOTAL = OPERACOES.length;

/**
 * A segunda metade da seção: as operações que a categoria não faz, cada uma
 * com o próprio diagrama.
 *
 * ── Por que esta NÃO prende a rolagem ──────────────────────────────────────
 *
 * Ela já foi um palco grudado, como a leitura logo acima. Duas seções seguidas
 * tomando a rolagem é demais: por duas telas inteiras a pessoa deixa de
 * decidir o ritmo e passa a "atravessar" a página. Aqui a página rola normal,
 * e o movimento acontece quando alguém escolhe uma operação. A primeira toca
 * sozinha ao entrar na tela, uma vez, para mostrar que a coisa se mexe.
 *
 * Isso também não é o revezamento automático que foi recusado antes: nada
 * troca sozinho, e cada troca é um ato de quem lê. O botão "Repetir" existe
 * porque, sem ele, rever um diagrama exigiria sair da operação e voltar.
 *
 * Abas de verdade (`tablist`), com as setas do padrão ARIA e o foco
 * acompanhando a seleção. No celular a lista vertical roubaria a altura do
 * diagrama, então ela vira uma fileira de pílulas roláveis.
 *
 * Só a cena ativa existe no DOM: as seis montadas seriam seis árvores com
 * NumberFlow, SVG e timeline para uma ficar visível.
 */
export function MesaDeOperacoes({ cabecalho }: { cabecalho: React.ReactNode }) {
  const { ref, armado, emVista } = useVisibilidade<HTMLDivElement>({
    limiar: 0.25,
  });
  const reduzido = useReducedMotion();
  const idBase = React.useId();
  const abas = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [escolha, setEscolha] = React.useState({ indice: 0, volta: 0 });
  const operacao = OPERACOES[escolha.indice];

  /** Uma volta nova remonta a cena, e a cena nova toca do começo. */
  const escolher = React.useCallback(
    (indice: number) =>
      setEscolha((atual) => ({ indice, volta: atual.volta + 1 })),
    [],
  );

  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    const destinos: Record<string, number> = {
      ArrowDown: Math.min(escolha.indice + 1, TOTAL - 1),
      ArrowRight: Math.min(escolha.indice + 1, TOTAL - 1),
      ArrowUp: Math.max(escolha.indice - 1, 0),
      ArrowLeft: Math.max(escolha.indice - 1, 0),
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
    <div ref={ref}>
      {cabecalho}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 md:mt-10 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:items-start md:gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-14">
        {/* No celular as pílulas rolam na horizontal; a máscara nas bordas diz
            que a fileira continua, sem precisar de seta nem de sombra. */}
        <div
          role="tablist"
          aria-label="Operações de exemplo"
          aria-orientation="vertical"
          onKeyDown={aoTeclar}
          className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 [mask-image:linear-gradient(90deg,transparent,#000_1.5rem,#000_calc(100%-1.5rem),transparent)] [scrollbar-width:none] md:mx-0 md:flex-col md:gap-0 md:overflow-visible md:px-0 md:[mask-image:none]"
        >
          {OPERACOES.map((item, i) => (
            <Aba
              key={item.cena}
              ref={(el) => {
                abas.current[i] = el;
              }}
              item={item}
              indice={i}
              ativa={i === escolha.indice}
              idBase={idBase}
              aoEscolher={() => escolher(i)}
            />
          ))}
        </div>

        <div
          role="tabpanel"
          id={`${idBase}-painel`}
          aria-labelledby={`${idBase}-aba-${escolha.indice}`}
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

            <div className="relative flex items-start justify-between gap-4">
              <p className="[font-family:var(--font-jetbrains-mono)] text-sm text-[var(--app-tint)]">
                {operacao.pedido}
              </p>
              {reduzido ? null : (
                <button
                  type="button"
                  onClick={() => escolher(escolha.indice)}
                  className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-[var(--app-text-muted)] transition-[color,border-color,transform] duration-150 hover:border-white/20 hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/60 active:scale-[0.97]"
                >
                  Repetir
                </button>
              )}
            </div>

            {/* Altura fixa, para o palco não pular entre cenas: a da cena mais
                alta em cada largura, que no celular é a da fatura, com a lista
                e o limite empilhados. */}
            <div className="relative mt-4 h-[22rem] md:mt-8 lg:h-[24rem]">
              <TrocaComSaida
                valor={escolha}
                chave={(e) => `${e.indice}-${e.volta}`}
                className="h-full"
              >
                {(atual) => {
                  const Cena = CENAS[OPERACOES[atual.indice].cena];
                  return <Cena armado={armado} tocar={emVista} />;
                }}
              </TrocaComSaida>
            </div>
          </div>

          <p className="mt-3 max-w-xl text-xs leading-relaxed text-[var(--app-text-muted)] md:mt-4 md:text-base">
            {operacao.efeito}
          </p>
        </div>
      </div>
    </div>
  );
}

interface AbaProps {
  item: Operacao;
  indice: number;
  ativa: boolean;
  idBase: string;
  aoEscolher: () => void;
  ref: React.Ref<HTMLButtonElement>;
}

/**
 * Uma aba. No celular é uma pílula numa fileira rolável; de `md` para cima, uma
 * linha da lista, com o fio à esquerda marcando a ativa.
 */
function Aba({ item, indice, ativa, idBase, aoEscolher, ref }: AbaProps) {
  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${idBase}-aba-${indice}`}
      aria-selected={ativa}
      aria-controls={`${idBase}-painel`}
      tabIndex={ativa ? 0 : -1}
      onClick={aoEscolher}
      className={cn(
        "shrink-0 snap-start whitespace-nowrap rounded-full border px-3.5 py-2 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-tint)]/60",
        "md:w-full md:whitespace-normal md:rounded-none md:border-0 md:border-l-2 md:px-4 md:py-3.5 md:text-base",
        ativa
          ? "border-[var(--app-tint)]/50 bg-[var(--app-tint)]/[0.08] text-[var(--app-text)] md:border-l-[var(--app-tint)] md:bg-transparent"
          : "border-white/10 text-[var(--app-text-muted)] hover:text-[var(--app-text)] md:border-l-white/10",
      )}
    >
      {item.pedido}
    </button>
  );
}
