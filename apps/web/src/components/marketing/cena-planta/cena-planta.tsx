import React from "react";

import { SemHidratar } from "@/components/marketing/_shared/sem-hidratar";

import {
  COMODOS,
  ITENS,
  NICHO_PADRAO,
  PAGAMENTO,
  PROPOSTA,
  TOTAL_CENTAVOS,
  formataReais,
  nichoPorId,
} from "./dados";
import { DivisaoDoPagamento, FolhaDaProposta, LegendasDaCena } from "./camadas-da-cena";
import { Diretor } from "./diretor";
import { EstiloDaCena } from "./estilo-da-cena";
import { PlantaSvg } from "./planta-svg";
import { CAIXA } from "./roteiro";
import { SeletorDeNicho } from "./seletor-de-nicho";

/**
 * O que a cena conta, em prosa, para quem não a vê. Montado dos mesmos dados
 * que o desenho e a proposta leem, então não tem como dizer outro número.
 * Começa por "exemplo" porque um cliente e um valor numa página de produto se
 * leem como caso real se nada disser o contrário.
 */
const RESUMO = `Exemplo ilustrativo: numa casa de ${COMODOS.length} ambientes, ${
  ITENS.length
} itens viram a proposta ${PROPOSTA.codigo}, de ${formataReais(
  TOTAL_CENTAVOS,
)}, para a ${PROPOSTA.cliente}. Aprovada, ela gera no financeiro uma entrada de ${formataReais(
  PAGAMENTO.entrada,
)} e ${PAGAMENTO.parcelas.length} parcelas de ${formataReais(
  PAGAMENTO.parcelas[0],
)}. O mesmo projeto é mostrado no vocabulário de ${
  nichoPorId("automacao").rotulo.toLowerCase()
}, de ${nichoPorId("cortinas").rotulo.toLowerCase()} e de ${nichoPorId(
  "marcenaria",
).rotulo.toLowerCase()}, que é um nicho configurado sob medida.`;

/**
 * A cena da planta: do ambiente especificado ao dinheiro lançado no financeiro.
 *
 * Uma cena longa (300vh de rolagem) com o palco preso na tela (`sticky`). As
 * peças, de baixo para cima:
 *
 * 1. **a casa**, em SVG isométrico (`planta-svg.tsx`), servida pronta e nunca
 *    hidratada; no desktop, o three.js assume por cima dela (`Diretor`);
 * 2. **as camadas**: as legendas de cada ato, a proposta que se monta e a
 *    divisão do pagamento, em HTML;
 * 3. **o seletor de nicho**, que reescreve os itens no vocabulário de outro
 *    negócio sem remontar nada.
 *
 * Tudo que muda com a rolagem é variável CSS: o `<style>` do servidor escreve o
 * começo e o fim da história (`EstiloDaCena`), e o diretor escreve o meio.
 *
 * Três armadilhas deste arquivo, todas silenciosas:
 *
 * - **nenhum ancestral do palco pode ter `overflow`**: overflow desliga
 *   `sticky` nos descendentes, e a cena passa reto pela tela. O
 *   `overflow-hidden` e a moldura arredondada moram NO palco, que é o que
 *   precisa recortar: a landing é clara, e o escuro daqui é o palco, não a
 *   faixa;
 * - **os tokens da noite moram NO palco** (`.superficie-noite`), e não na
 *   seção: a landing em volta é clara, e o escuro é a maquete. Nenhum token
 *   pode subir para o `[data-cena-planta]`, que é a trilha inteira de 300vh e
 *   pintaria uma faixa escura atrás da moldura;
 * - **o palco é o container** (`container-type: size`), e todo deslocamento da
 *   cena é em `cqw`/`cqh` dele. Porcentagem num `translate` seria relativa ao
 *   próprio elemento, e a folha e a casa têm tamanhos diferentes;
 * - **sob movimento reduzido** a trilha perde a altura, o palco deixa de ser
 *   preso e as camadas entram no fluxo, empilhadas (globals.css, `.cena-*`).
 *   O quadro é o final, composto, sem nada escondido esperando uma rolagem.
 */
export function CenaPlanta() {
  const aspecto = CAIXA.largura / CAIXA.altura;

  return (
    <div
      data-cena-planta=""
      data-ato="repouso"
      data-nicho={NICHO_PADRAO}
      className="relative"
      style={{ "--aspecto": String(aspecto) } as React.CSSProperties}
    >
      <EstiloDaCena />

      <div className="cena-trilha relative h-[300vh]">
        <div
          data-palco=""
          className="superficie-noite cena-palco sticky top-3 h-[calc(100svh-1.5rem)] overflow-hidden rounded-[1.75rem] border border-white/10"
        >
          <div aria-hidden="true" className="superficie-noite__luz pointer-events-none absolute inset-0" />

          <div className="cena-lugar-casa pointer-events-none absolute inset-0 flex">
            <div data-casa="" className="cena-casa pointer-events-auto relative">
              <SemHidratar className="absolute inset-0">
                <PlantaSvg className="absolute inset-0 h-full w-full overflow-visible" />
              </SemHidratar>
              <Diretor />
            </div>
          </div>

          <div className="cena-lugar-nichos pointer-events-none absolute inset-x-0 top-0">
            <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
              <SeletorDeNicho />
            </div>
          </div>

          <div aria-hidden="true" className="cena-lugar-legendas pointer-events-none absolute inset-0">
            <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
              <LegendasDaCena />
            </div>
          </div>

          <div aria-hidden="true" className="cena-lugar-folha pointer-events-none absolute">
            <FolhaDaProposta />
            <DivisaoDoPagamento />
          </div>
        </div>
      </div>

      <p className="sr-only">{RESUMO}</p>
    </div>
  );
}
