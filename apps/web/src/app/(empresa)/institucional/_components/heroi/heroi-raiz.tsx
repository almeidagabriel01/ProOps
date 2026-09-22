import React from "react";

import { SemHidratar } from "@/components/marketing/_shared/sem-hidratar";

import {
  COMODOS,
  ITENS,
  PAGAMENTO,
  PROPOSTA,
  TOTAL_CENTAVOS,
  formataReais,
} from "../../_content/cena-planta";
import {
  DivisaoDoPagamento,
  FolhaDaProposta,
  LegendasDaCena,
  MensagemDoAplicativo,
} from "./camadas-da-cena";
import { Diretor } from "./diretor";
import { EsperaDaAbertura } from "./espera-da-abertura";
import { EstiloDaCena } from "./estilo-da-cena";
import { PlantaSvg } from "./planta-svg";
import { CAIXA } from "./roteiro";
import { TextoDoHeroi } from "./texto-do-heroi";

/**
 * O que a cena conta, em prosa, para quem não a vê. Montado dos mesmos dados
 * que o desenho e a proposta leem, então não tem como dizer outro número.
 * Começa por "exemplo" porque um cliente e um valor numa página institucional
 * se leem como caso real se nada disser o contrário.
 */
const RESUMO = `Exemplo ilustrativo: numa casa de ${COMODOS.length} cômodos, ${
  ITENS.length
} itens de automação e cortinas viram a proposta ${PROPOSTA.codigo}, de ${formataReais(
  TOTAL_CENTAVOS,
)}, para a ${PROPOSTA.cliente}. Aprovada, ela gera uma entrada de ${formataReais(
  PAGAMENTO.entrada,
)} e ${PAGAMENTO.parcelas.length} parcelas de ${formataReais(
  PAGAMENTO.parcelas[0],
)} no financeiro, e o aplicativo avisa quando a entrada cai na conta.`;

/**
 * O herói da raiz: uma proposta acompanhada da planta ao dinheiro na conta.
 *
 * Uma cena longa (300vh de rolagem) com o palco preso na tela (`sticky`). As
 * peças, de baixo para cima:
 *
 * 1. **a casa**, em SVG isométrico (`PlantaSvg`), servida pronta e nunca
 *    hidratada; no desktop, o three.js assume por cima dela (`Diretor`);
 * 2. **o texto** da primeira dobra, que é o LCP, em CSS puro;
 * 3. **as camadas**: legendas, a proposta, a divisão do pagamento e a mensagem
 *    do aplicativo, em HTML.
 *
 * Tudo que muda com a rolagem é variável CSS: o `<style>` do servidor escreve o
 * começo e o fim da história (`EstiloDaCena`), e o diretor escreve o meio.
 *
 * Três armadilhas deste arquivo, todas silenciosas:
 *
 * - **nenhum ancestral do palco pode ter `overflow`**: overflow desliga
 *   `sticky` nos descendentes, e a cena passa reto pela tela. O `overflow-hidden`
 *   mora NO palco, que é o que precisa recortar;
 * - **o palco é o container** (`container-type: size`), e todo deslocamento da
 *   cena é em `cqw`/`cqh` dele. Porcentagem num `translate` seria relativa ao
 *   próprio elemento, e a folha e a casa têm tamanhos diferentes;
 * - **sob movimento reduzido** a trilha perde a altura, o palco deixa de ser
 *   preso e as camadas entram no fluxo, empilhadas (globals.css, `.cena-*`).
 *   O quadro é o final, composto, sem nada escondido esperando uma rolagem.
 */
export function HeroiRaiz() {
  const aspecto = CAIXA.largura / CAIXA.altura;

  return (
    <EsperaDaAbertura
      aria-label="ProOps"
      data-cena-planta=""
      data-ato="repouso"
      className="heroi-noite relative"
      style={{ "--aspecto": String(aspecto) } as React.CSSProperties}
    >
      <EstiloDaCena />

      <div className="cena-trilha relative h-[300vh]">
        <div data-palco="" className="cena-palco sticky top-0 h-[100svh] overflow-hidden">
          <div aria-hidden="true" className="heroi-noite__luz pointer-events-none absolute inset-0" />

          <div className="cena-lugar-casa pointer-events-none absolute inset-0 flex">
            <div data-casa="" className="cena-casa pointer-events-auto relative">
              <SemHidratar className="absolute inset-0">
                <PlantaSvg className="absolute inset-0 h-full w-full overflow-visible" />
              </SemHidratar>
              <Diretor />
            </div>
          </div>

          <div data-camada="texto" className="cena-texto absolute inset-0 flex">
            <div className="mx-auto w-full max-w-7xl px-6 md:px-10">
              <TextoDoHeroi />
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

          <div aria-hidden="true" className="cena-lugar-mensagem pointer-events-none absolute">
            <MensagemDoAplicativo />
          </div>

        </div>
      </div>

      <p className="sr-only">{RESUMO}</p>
    </EsperaDaAbertura>
  );
}
