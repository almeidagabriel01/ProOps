import React from "react";

import { cn } from "@/lib/utils";

import {
  BarraDeStatus,
  CabecalhoApp,
  Dinheiro,
  LinhaLancamento,
  PainelDestaque,
  RotuloSecao,
  TabBar,
  TelaApp,
} from "./pecas";

/**
 * A aba Financeiro, reconstruída.
 *
 * É a tela que prova a frase do produto: o que foi dito numa conversa vira um
 * lançamento com conta, categoria e valor. Por isso ela aceita marcar UM item
 * como recém-chegado (`novo`), e é isso que a cena "Um dia" acende no momento em
 * que a mensagem correspondente é enviada.
 *
 * O cartão de crédito é desenhado como um CARTÃO e não como um card de conteúdo,
 * com a anatomia que o `design.md` do aplicativo exige: chip, contactless,
 * número mascarado, fatura atual em display, fechamento, barra de limite e o
 * rodapé com vencimento e disponível. Sem essas peças o bloco lê como uma caixa
 * com um número dentro, que foi exatamente a queixa registrada lá.
 *
 * A cor do emissor NÃO entra. No aplicativo ela é permitida dentro da forma de
 * um cartão, porque ali a pessoa já espera a marca do próprio banco; numa página
 * pública ela sugere uma integração que não existe.
 */

export interface Lancamento {
  titulo: string;
  meta: string;
  valor: string;
  /** Acende o item como recém-criado. No máximo um por tela. */
  novo?: boolean;
}

export interface DadosFinanceiro {
  hora: string;
  mes: string;
  sobra: string;
  linhaSecundaria: string;
  cartao: {
    nome: string;
    fatura: string;
    fechaEm: string;
    venceEm: string;
    disponivel: string;
    /** Quanto da linha de crédito já foi usada, de 0 a 1. */
    usoDoLimite: number;
  };
  lancamentos: Lancamento[];
}

export const FINANCEIRO_PADRAO: DadosFinanceiro = {
  hora: "12:31",
  mes: "Setembro de 2026",
  sobra: "R$ 1.284,90",
  linhaSecundaria: "entrou R$ 6.400,00 · saiu R$ 2.095,10 · ainda sai R$ 3.020,00",
  cartao: {
    nome: "Cartão da casa",
    fatura: "R$ 1.350,00",
    fechaEm: "20/09",
    venceEm: "27/09",
    disponivel: "R$ 4.577,00",
    usoDoLimite: 0.23,
  },
  lancamentos: [
    {
      titulo: "Mercado",
      meta: "Alimentação · Cartão da casa",
      valor: "R$ 45,00",
      novo: true,
    },
    {
      titulo: "Marcenaria",
      meta: "Casa · lançado no app",
      valor: "R$ 320,00",
    },
    {
      titulo: "Energia",
      meta: "Moradia · débito automático",
      valor: "R$ 212,40",
    },
  ],
};

export function TelaFinanceiro({
  dados = FINANCEIRO_PADRAO,
}: {
  dados?: DadosFinanceiro;
}) {
  return (
    <TelaApp>
      <BarraDeStatus hora={dados.hora} />
      <CabecalhoApp />

      <div className="min-h-0 flex-1 overflow-hidden px-[5cqw] pt-[3.4cqw]">
        <div
          aria-hidden="true"
          className="flex items-center justify-center gap-[4cqw] text-[3.6cqw] font-medium text-[var(--app-text-muted)]"
        >
          <span className="text-[var(--app-tint)]">‹</span>
          {dados.mes}
          <span className="text-[var(--app-tint)]">›</span>
        </div>

        <PainelDestaque className="mt-[3cqw]">
          <p className="text-[2.9cqw] font-semibold uppercase tracking-[0.2em] text-[var(--app-on-hero-muted)]">
            Sobra até o fim do mês
          </p>
          <Dinheiro className="mt-[2cqw] block text-[8.4cqw] font-bold leading-none">
            {dados.sobra}
          </Dinheiro>
          <p className="mt-[2.2cqw] text-[2.9cqw] leading-snug text-[var(--app-tint)]">
            {dados.linhaSecundaria}
          </p>
        </PainelDestaque>

        <div className="mt-[4cqw]">
          <RotuloSecao direita="Ver todos">Cartões</RotuloSecao>
          <CartaoDeCredito cartao={dados.cartao} />
        </div>

        <div className="mt-[4cqw]">
          <RotuloSecao direita="Ver todos">Últimos lançamentos</RotuloSecao>
          <div className="mt-[2.4cqw] flex flex-col gap-[2.2cqw]">
            {dados.lancamentos.map((lancamento) => (
              <LinhaLancamento
                key={lancamento.titulo}
                titulo={lancamento.titulo}
                meta={lancamento.meta}
                valor={lancamento.valor}
                className={cn(
                  lancamento.novo &&
                    "border-[var(--app-tint)]/45 bg-[var(--app-tint)]/[0.07]",
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <TabBar ativa="financeiro" />
    </TelaApp>
  );
}

/** O cartão, com a anatomia que o faz ler como cartão e não como caixa. */
function CartaoDeCredito({ cartao }: { cartao: DadosFinanceiro["cartao"] }) {
  return (
    <div className="relative mt-[2.6cqw] overflow-hidden rounded-[4cqw] border border-white/[0.09] bg-[linear-gradient(145deg,#2f2f33,#1c1c1f)] p-[4.4cqw]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[3.4cqw] font-medium">{cartao.nome}</p>
          <div
            aria-hidden="true"
            className="mt-[2.6cqw] flex items-center gap-[2.4cqw]"
          >
            {/* Chip EMV */}
            <span className="relative h-[5.4cqw] w-[7.4cqw] overflow-hidden rounded-[1.2cqw] bg-[linear-gradient(135deg,#e8c87a,#b8933f)]">
              <span className="absolute inset-x-0 top-1/2 h-px bg-black/25" />
              <span className="absolute inset-y-0 left-1/2 w-px bg-black/25" />
            </span>
            {/* Contactless */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-[4.6cqw] w-[4.6cqw] stroke-[var(--app-text-muted)]"
            >
              <path d="M7 5.5a9 9 0 010 13M11.5 8a5.4 5.4 0 010 8M16 10.4a2.2 2.2 0 010 3.2" />
            </svg>
          </div>
        </div>
        <p
          aria-hidden="true"
          className="[font-family:var(--font-jetbrains-mono)] text-[3.1cqw] text-[var(--app-text-muted)]"
        >
          •••• 4821
        </p>
      </div>

      <p className="mt-[3.4cqw] text-[2.7cqw] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
        Fatura atual
      </p>
      <div className="flex items-baseline justify-between gap-[3cqw]">
        <Dinheiro className="text-[6.6cqw] font-bold leading-tight">
          {cartao.fatura}
        </Dinheiro>
        <p className="shrink-0 text-[2.8cqw] text-[var(--app-text-muted)]">
          fecha {cartao.fechaEm}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="mt-[3cqw] h-[1.4cqw] overflow-hidden rounded-full bg-white/10"
      >
        <span
          className="block h-full rounded-full bg-[var(--app-text-muted)]"
          style={{ width: `${Math.round(cartao.usoDoLimite * 100)}%` }}
        />
      </div>

      <div className="mt-[2.6cqw] flex items-baseline justify-between gap-[3cqw] text-[2.8cqw] text-[var(--app-text-muted)]">
        <span>vence {cartao.venceEm}</span>
        <span>
          Disponível{" "}
          <Dinheiro className="text-[var(--app-tint)]">
            {cartao.disponivel}
          </Dinheiro>
        </span>
      </div>
    </div>
  );
}
