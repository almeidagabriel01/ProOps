import React from "react";

import { cn } from "@/lib/utils";

import {
  ITENS,
  NICHOS,
  PAGAMENTO,
  PROPOSTA,
  TOTAL_CENTAVOS,
  comodoPorId,
  formataReais,
} from "./dados";
import { LEGENDAS, TRILHO } from "./copy";

/**
 * O que a cena escreve por cima da casa: a proposta e a divisão do pagamento.
 *
 * HTML e não SVG nem three.js, de propósito. É texto de verdade, na fonte da
 * página, legível em qualquer escala e selecionável; e é o MESMO texto por
 * cima dos dois renderizadores da casa, então trocar o SVG pelo 3D não muda uma
 * letra. Tudo é `aria-hidden`: a cena é uma ilustração, e o leitor de tela
 * recebe o resumo em prosa (`heroi-raiz.tsx`), que diz a mesma coisa em uma
 * frase em vez de em cinquenta fragmentos.
 *
 * Componente de servidor. Toda a animação é por variáveis CSS, escritas pelo
 * `<style>` do servidor e depois pelo diretor, e lidas pelas regras
 * `.cena-*` do globals.css, sempre em `opacity`, `translate`, `scale` ou
 * `stroke-dashoffset`: nada aqui mexe em layout durante a rolagem, que é o que
 * mantém o CLS em zero com a cena andando.
 *
 * **O item é o chip.** Não existe um chip que voa e uma linha que aparece: é o
 * mesmo `<li>`, que repousa na linha da proposta e é deslocado pelo diretor até
 * o cômodo dele enquanto a proposta não existe. Por isso a folha não pode ter
 * `opacity` própria: ela apagaria os filhos junto, chips incluídos. Cada parte
 * da folha tem a sua.
 */

const PARTES_DO_PAGAMENTO = [
  { rotulo: `Entrada, ${PROPOSTA.entradaPercentual}%`, centavos: PAGAMENTO.entrada },
  ...PAGAMENTO.parcelas.map((centavos, i) => ({
    rotulo: `Parcela ${i + 1} de ${PAGAMENTO.parcelas.length}`,
    centavos,
  })),
];

/** A proposta, montada item a item. */
export function FolhaDaProposta() {
  return (
    <div data-folha="" className="cena-folha relative w-full text-[var(--tinta)]">
      <div aria-hidden="true" className="cena-folha__papel absolute inset-0 rounded-[10px] bg-[var(--papel)]" />

      <div className="cena-folha__cabeca relative flex items-baseline justify-between gap-4 px-5 pb-3 pt-4">
        <p className="[font-family:var(--font-bricolage)] text-[15px] font-bold tracking-tight">
          {PROPOSTA.cliente}
        </p>
        <p className="cena-folha__codigo [font-family:var(--font-geist-mono)] text-[11px] text-slate-500">
          Proposta {PROPOSTA.codigo}
        </p>
      </div>

      <ol className="relative px-5">
        {ITENS.map((item, i) => (
          <li
            key={item.id}
            data-chip={i}
            className="cena-chip relative grid grid-cols-[1fr_auto] items-baseline gap-3 py-[3px] lg:py-[5px]"
            style={
              {
                "--surge": `var(--chip-${i}-surge)`,
                "--voo": `var(--chip-${i}-voo)`,
                "--linha": `var(--linha-${i})`,
                "--dx": `var(--chip-${i}-x, 0px)`,
                "--dy": `var(--chip-${i}-y, 0px)`,
              } as React.CSSProperties
            }
          >
            <span data-rotulo="" className="cena-chip__rotulo relative w-fit">
              <span aria-hidden="true" className="cena-chip__pilula absolute -inset-x-2.5 -inset-y-1.5 rounded-full" />
              <span aria-hidden="true" className="cena-chip__luz absolute -left-[18px] top-1/2 size-1.5 -mt-[3px] rounded-full" />
              {/* Um rótulo por nicho, e o CSS mostra o do nicho ativo
                  (`[data-nicho]` na seção). Trocar de nicho não remonta a cena
                  nem mexe no DOM: é uma regra de CSS, e o chip que está voando
                  continua voando. */}
              {NICHOS.map((nicho) => (
                <span
                  key={nicho.id}
                  data-rotulo-de={nicho.id}
                  className="cena-chip__nome relative block text-[12.5px] font-medium leading-tight"
                >
                  {nicho.rotulos[i]}
                </span>
              ))}
              {/* No retrato a folha divide a tela com a casa, e o nome do
                  cômodo é a linha que sobra: o chip ainda aponta para ele. */}
              <span className="relative hidden text-[11px] leading-tight text-slate-500 min-[400px]:block lg:block">
                {comodoPorId(item.comodo).nome}
              </span>
            </span>
            <span className="cena-chip__valor text-[12.5px] font-medium tabular-nums">
              {formataReais(item.centavos)}
            </span>
          </li>
        ))}
      </ol>

      <div className="cena-folha__rodape relative mt-2 px-5 pb-4">
        <div className="flex items-baseline justify-between border-t border-slate-300 pt-3">
          <span className="text-[12.5px] text-slate-500">Total</span>
          {/* Largura fixa e algarismos tabulares: o total conta durante a
              rolagem, e um número que muda de largura empurraria o que está do
              lado, que é deslocamento de layout na conta do CLS. */}
          <span
            data-total=""
            className="inline-block min-w-[9ch] text-right [font-family:var(--font-bricolage)] text-lg font-bold tabular-nums tracking-tight"
          >
            {formataReais(TOTAL_CENTAVOS)}
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <svg viewBox="0 0 160 40" aria-hidden="true" className="h-9 w-36 overflow-visible text-slate-800">
            <path
              className="cena-assinatura"
              pathLength={1}
              d="M4 28c10-14 18-22 22-18s-8 20-4 20 14-22 20-20-6 18 0 18 12-16 18-16-4 14 2 14 10-10 16-10 4 6 10 6 12-4 20-6 14-2 24-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M2 36H150" stroke="rgb(163 163 163)" strokeWidth="1" />
          </svg>
          <span className="cena-selo rounded-[6px] border-[1.5px] border-slate-800 px-2 py-0.5 text-[11px] font-bold tracking-wide text-slate-800">
            Aprovada
          </span>
        </div>
      </div>
    </div>
  );
}

/** Entrada e parcelas, como o financeiro da ProOps as lança. */
export function DivisaoDoPagamento() {
  return (
    <div className="cena-divisao relative mt-3 w-full rounded-[10px] border border-white/10 bg-[var(--noite-alta)]/95 px-5 py-4 text-white shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]">
      <p className="mb-2 text-[12px] text-white/55">Lançado no financeiro</p>
      <ul>
        {PARTES_DO_PAGAMENTO.map((parte, i) => (
          <li
            key={parte.rotulo}
            className="cena-parte flex items-baseline justify-between py-[3px] text-[12.5px]"
            style={{ "--parte": `var(--parte-${i})` } as React.CSSProperties}
          >
            <span className={cn(i === 0 ? "text-white" : "text-white/65")}>{parte.rotulo}</span>
            <span className={cn("tabular-nums", i === 0 ? "font-semibold text-white" : "text-white/65")}>
              {formataReais(parte.centavos)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Uma legenda por ato, e o trilho dos quatro atos embaixo delas. */
export function LegendasDaCena() {
  const atos = ["projeto", "proposta", "aprovada", "financeiro"] as const;
  return (
    <div className="cena-legendas w-full max-w-[26rem]">
      <div className="relative min-h-[5.5rem] md:min-h-[6.75rem]">
        {atos.map((ato) => (
          <p
            key={ato}
            data-legenda={ato}
            className="cena-legenda absolute inset-x-0 top-0 [font-family:var(--font-bricolage)] text-xl font-semibold leading-snug tracking-tight text-white md:text-[1.6rem]"
            style={{ "--legenda": `var(--legenda-${ato})` } as React.CSSProperties}
          >
            {LEGENDAS[ato]}
          </p>
        ))}
      </div>
      <ol className="mt-5 flex gap-4 text-[12px]">
        {atos.map((ato) => (
          <li key={ato} data-trilho={ato} className="cena-trilho flex flex-col gap-1.5">
            <span aria-hidden="true" className="cena-trilho__barra block h-px w-12 bg-white/15" />
            <span className="text-white/40">{TRILHO[ato]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
