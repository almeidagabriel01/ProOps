import React from "react";

import { calcularProposta, type PropostaDeExemplo } from "@/lib/landing/proposta-de-exemplo";
import { cap, type NicheVocabulary } from "@/lib/niches/vocabulary";

import { MockBotao, MockChip, MockTela, MockValor } from "../pecas";
import { CascaDoErp } from "./comum";

interface TelaPropostaDoNichoProps {
  proposta: PropostaDeExemplo;
  vocabulario: NicheVocabulary;
  className?: string;
}

/**
 * A proposta de um nicho aberta no ERP: os grupos com o nome do nicho (ambiente,
 * sistema, solução), cada item com a medida escrita como no PDF, e os totais
 * calculados pelo motor de preço de verdade (`calcularProposta`).
 */
export function TelaPropostaDoNicho({ proposta, vocabulario, className }: TelaPropostaDoNichoProps) {
  const calculada = calcularProposta(proposta);
  return (
    <MockTela className={className} data-tela="proposta-do-nicho">
      <CascaDoErp
        ativo="Propostas"
        titulo={proposta.titulo}
        acoes={
          <span className="mk-gap-1 flex items-center">
            <MockChip tom="acento">Rascunho salvo</MockChip>
            <MockBotao>Gerar PDF</MockBotao>
          </span>
        }
      >
        <div className="mk-t-1 mk-suave">Cliente: {proposta.cliente}</div>
        <div className="mk-gap-2 mk-mt-2 flex flex-col">
          {calculada.grupos.map((grupo) => (
            <div key={grupo.nome} data-mk="grupo" className="mk-rounded-2 border mk-linha">
              <div className="mk-px-2 mk-py-1.5 flex items-center justify-between border-b mk-linha mk-sup">
                <span className="mk-t-2 font-bold">
                  <span className="mk-acento">{cap(vocabulario.group.singular)}</span> · {grupo.nome}
                </span>
                <MockValor valor={grupo.subtotal} className="mk-t-2 font-semibold" />
              </div>
              {grupo.itens.map((item) => (
                <div key={item.descricao} className="mk-px-2 mk-py-1 mk-gap-2 flex items-baseline justify-between border-b mk-linha last:border-b-0">
                  <span className="min-w-0">
                    <span className="mk-t-2 block truncate">{item.descricao}</span>
                    <span className="mk-t-1 mk-suave block tabular-nums">{item.medida}</span>
                  </span>
                  <MockValor valor={item.total} className="mk-t-2" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mk-mt-2 flex items-baseline justify-between">
          <span className="mk-t-2 mk-suave">Total da proposta</span>
          <MockValor valor={calculada.total} className="texto-acento mk-t-5 font-bold" data-mk="total" />
        </div>
      </CascaDoErp>
    </MockTela>
  );
}
