import React from "react";
import { CalendarDays, Check, FileText, LayoutDashboard, Menu } from "lucide-react";

import { buildProposalCodePreview } from "@/lib/proposal-numbering";
import { cn } from "@/lib/utils";

import { CLIENTE_DEMO, CODIGO_DEMO, GRUPOS_DEMO, PARCELAS_DEMO, TITULO_DEMO, TOTAL_DEMO } from "../dados";
import {
  MockAvatar,
  MockBloco,
  MockBotao,
  MockChip,
  MockEtapas,
  MockLinhaDeLista,
  MockTela,
  MockValor,
} from "../pecas";
import { BarraDoCelular, CascaDoErp } from "./comum";

/**
 * As telas do dia a dia de cadastro e controle: contato, catálogo, a proposta
 * sendo montada, os lançamentos, as permissões da equipe e o painel no
 * celular. Mesma história de demonstração das outras réplicas (`../dados`):
 * a venda da Ana aparece aqui com o mesmo código e os mesmos valores.
 */

interface TelaProps {
  className?: string;
}

const A_RECEBER = PARCELAS_DEMO.filter((p) => p.estado === "aberto").reduce((s, p) => s + p.valor, 0);

/** Contatos › ficha: a venda, o financeiro e a próxima ação do mesmo cliente. */
export function TelaContato({ className }: TelaProps) {
  const outra = buildProposalCodePreview({ number: 176, year: 2026, praca: "SP" });
  return (
    <MockTela className={className} data-tela="contato">
      <CascaDoErp ativo="Contatos" titulo={CLIENTE_DEMO} acoes={<MockBotao variante="contorno">Portal do cliente</MockBotao>}>
        <div className="mk-gap-1 flex items-center">
          <MockChip tom="acento">Cliente</MockChip>
          <MockChip>Indicação de arquiteto</MockChip>
        </div>
        <div className="mk-gap-2 mk-mt-2 grid grid-cols-[1.2fr_1fr]">
          <MockBloco titulo="Propostas">
            <MockLinhaDeLista
              titulo={TITULO_DEMO}
              detalhe={CODIGO_DEMO}
              fim={
                <span className="mk-gap-1 flex items-center">
                  <MockValor valor={TOTAL_DEMO} className="mk-t-1 font-semibold" />
                  <MockChip tom="positivo">Aprovada</MockChip>
                </span>
              }
            />
            <MockLinhaDeLista
              titulo="Home theater da sala"
              detalhe={outra}
              fim={
                <span className="mk-gap-1 flex items-center">
                  <MockValor valor={9800} className="mk-t-1 font-semibold" />
                  <MockChip>Enviada</MockChip>
                </span>
              }
            />
          </MockBloco>
          <div className="mk-gap-2 flex flex-col">
            <MockBloco titulo="Financeiro">
              <div className="flex items-baseline justify-between">
                <span className="mk-t-1 mk-suave">A receber</span>
                <MockValor valor={A_RECEBER} className="mk-t-3 font-bold" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="mk-t-1 mk-suave">Pago</span>
                <MockValor valor={PARCELAS_DEMO[0].valor} className="mk-t-2 font-semibold" />
              </div>
            </MockBloco>
            <MockBloco titulo="Próxima ação">
              <div className="mk-gap-1.5 flex items-center">
                <MockAvatar nome="Diego Lima" />
                <span className="min-w-0">
                  <span className="mk-t-2 block truncate font-semibold">Visita técnica</span>
                  <span className="mk-t-1 mk-suave block">Qui, 09:00 · Diego Lima</span>
                </span>
              </div>
            </MockBloco>
          </div>
        </div>
      </CascaDoErp>
    </MockTela>
  );
}

/**
 * Produtos: custo, margem e preço de venda. O preço sai do custo e da margem,
 * então a coluna de venda é calculada, e os itens vêm de segmentos diferentes
 * de propósito: por unidade e por medida lado a lado.
 */
export function TelaCatalogo({ className }: TelaProps) {
  const produtos = [
    { nome: "Central de automação", custo: 1850, margem: 40, unidade: "14 un" },
    { nome: "Persiana rolô blackout", custo: 180, margem: 60, unidade: "por m²" },
    { nome: "Câmera IP 4 MP", custo: 420, margem: 55, unidade: "38 un" },
    { nome: "Vidro temperado 8 mm", custo: 210, margem: 50, unidade: "por m²" },
    { nome: "Trilho de alumínio", custo: 46, margem: 70, unidade: "por metro" },
  ];
  return (
    <MockTela className={className} data-tela="catalogo">
      <CascaDoErp ativo="Produtos" titulo="Produtos" acoes={<MockBotao>Novo produto</MockBotao>}>
        <div className="mk-t-1 mk-tenue mk-gap-2 mk-py-1 grid grid-cols-[minmax(0,2fr)_1fr_0.7fr_1fr_0.9fr] border-b mk-linha font-semibold uppercase tracking-[0.05em]">
          <span>Produto</span>
          <span className="text-right">Custo</span>
          <span className="text-right">Margem</span>
          <span className="text-right">Venda</span>
          <span className="text-right">Estoque</span>
        </div>
        {produtos.map((p, i) => (
          <div
            key={p.nome}
            data-mk={i === 1 ? "linha-alvo" : undefined}
            className="mk-gap-2 mk-py-1.5 grid grid-cols-[minmax(0,2fr)_1fr_0.7fr_1fr_0.9fr] items-center border-b mk-linha last:border-b-0"
          >
            <span className="mk-gap-1.5 flex min-w-0 items-center">
              <span className="mk-size-4 mk-rounded-1 shrink-0 bg-[var(--mk-sup-2)]" />
              <span className="mk-t-2 truncate font-semibold">{p.nome}</span>
            </span>
            <MockValor valor={p.custo} className="mk-t-1 mk-suave text-right" />
            <span className="mk-t-1 text-right tabular-nums">{p.margem}%</span>
            <MockValor valor={Math.round(p.custo * (1 + p.margem / 100) * 100) / 100} className="mk-t-2 text-right font-semibold" />
            <span className="mk-t-1 mk-suave text-right">{p.unidade}</span>
          </div>
        ))}
      </CascaDoErp>
    </MockTela>
  );
}

/** Propostas › Nova: o assistente no passo dos itens, com o rascunho salvo. */
export function TelaPropostaEmPassos({ className }: TelaProps) {
  const passos = [
    { nome: "Cliente", estado: "feita" },
    { nome: "Itens", estado: "atual" },
    { nome: "Pagamento", estado: "proxima" },
    { nome: "PDF", estado: "proxima" },
  ] as const;
  return (
    <MockTela className={className} data-tela="proposta-em-passos">
      <CascaDoErp ativo="Propostas" titulo="Nova proposta" acoes={<MockChip tom="positivo">Rascunho salvo</MockChip>}>
        <MockEtapas etapas={passos} />
        <div className="mk-mt-2 mk-gap-1 flex items-baseline justify-between">
          <span className="mk-t-2 truncate font-semibold">
            {TITULO_DEMO} · {CLIENTE_DEMO}
          </span>
          <span className="mk-t-1 mk-tenue shrink-0">{CODIGO_DEMO}</span>
        </div>
        <div className="mk-gap-1.5 mk-mt-1.5 flex flex-col">
          {GRUPOS_DEMO.map((g) => (
            <MockBloco key={g.nome} className="mk-py-1.5">
              <div className="flex items-baseline justify-between">
                <span className="mk-t-2 font-semibold">{g.nome}</span>
                <MockValor valor={g.subtotal} className="mk-t-2 font-semibold" />
              </div>
              <div className="mk-gap-1 mk-mt-1 flex">
                {Array.from({ length: g.itens }, (_, i) => (
                  <span key={i} className="mk-h-1 mk-rounded-0.5 block flex-1 bg-[var(--mk-sup-2)]" />
                ))}
              </div>
            </MockBloco>
          ))}
        </div>
        <div className="mk-mt-2 flex items-center justify-between">
          <span className="mk-t-1 mk-suave">{GRUPOS_DEMO.reduce((s, g) => s + g.itens, 0)} itens em {GRUPOS_DEMO.length} grupos</span>
          <span className="mk-gap-2 flex items-center">
            <MockValor valor={TOTAL_DEMO} className="mk-t-4 font-bold" data-mk="total" />
            <MockBotao>Próximo</MockBotao>
          </span>
        </div>
      </CascaDoErp>
    </MockTela>
  );
}

/** Financeiro › Lançamentos, aba Agrupados: a venda com as parcelas e a comissão. */
export function TelaLancamentos({ className }: TelaProps) {
  const comissao = Math.round(TOTAL_DEMO * 0.05 * 100) / 100;
  return (
    <MockTela className={className} data-tela="lancamentos">
      <CascaDoErp
        ativo="Financeiro"
        titulo="Lançamentos"
        acoes={
          <span className="mk-gap-1 flex">
            <MockChip>Todos</MockChip>
            <MockChip tom="acento">Agrupados</MockChip>
          </span>
        }
      >
        <div className="mk-gap-2 grid grid-cols-3">
          {[
            { rotulo: "Recebido no mês", valor: PARCELAS_DEMO[0].valor },
            { rotulo: "A receber", valor: A_RECEBER },
            { rotulo: "Comissões a pagar", valor: comissao },
          ].map((kpi) => (
            <MockBloco key={kpi.rotulo}>
              <div className="mk-t-1 mk-suave">{kpi.rotulo}</div>
              <MockValor valor={kpi.valor} className="mk-t-4 block font-bold" />
            </MockBloco>
          ))}
        </div>
        <MockBloco className="mk-mt-2" titulo={`Venda ${CODIGO_DEMO} · ${CLIENTE_DEMO}`}>
          {PARCELAS_DEMO.map((p) => (
            <MockLinhaDeLista
              key={p.rotulo}
              titulo={p.rotulo}
              detalhe={`Vence ${p.vencimento} · Conta principal`}
              fim={
                <span className="mk-gap-1 flex items-center">
                  <MockValor valor={p.valor} className="mk-t-1 font-semibold" />
                  {p.estado === "pago" ? <MockChip tom="positivo">Pago</MockChip> : <MockChip tom="atencao">Pendente</MockChip>}
                </span>
              }
            />
          ))}
          <MockLinhaDeLista
            titulo="Comissão do vendedor"
            detalhe="5% · acompanha as parcelas"
            fim={<MockValor valor={comissao} className="mk-t-1 font-semibold" />}
          />
        </MockBloco>
      </CascaDoErp>
    </MockTela>
  );
}

/** Configurações › Equipe: ver, criar, editar e excluir, tela por tela. */
export function TelaEquipe({ className }: TelaProps) {
  const acoes = ["Ver", "Criar", "Editar", "Excluir"];
  const telas: { nome: string; liga: boolean[] }[] = [
    { nome: "Propostas", liga: [true, true, true, false] },
    { nome: "Obras", liga: [true, true, true, true] },
    { nome: "Agenda", liga: [true, true, true, true] },
    { nome: "Financeiro", liga: [true, false, false, false] },
    { nome: "Notas fiscais", liga: [false, false, false, false] },
  ];
  return (
    <MockTela className={className} data-tela="equipe">
      <CascaDoErp ativo="" titulo="Equipe" acoes={<MockBotao>Convidar</MockBotao>}>
        <div className="mk-gap-1.5 flex items-center">
          <MockAvatar nome="Diego Lima" />
          <span className="min-w-0 flex-1">
            <span className="mk-t-2 block font-semibold">Diego Lima</span>
            <span className="mk-t-1 mk-suave block">Perfil: técnico de instalação</span>
          </span>
          <MockChip tom="positivo">Vale na hora</MockChip>
        </div>
        <div className="mk-mt-2 mk-t-1 mk-tenue mk-py-1 grid grid-cols-[minmax(0,1.6fr)_repeat(4,1fr)] border-b mk-linha font-semibold uppercase tracking-[0.05em]">
          <span>Tela</span>
          {acoes.map((a) => (
            <span key={a} className="text-center">
              {a}
            </span>
          ))}
        </div>
        {telas.map((t) => (
          <div key={t.nome} className="mk-py-1.5 grid grid-cols-[minmax(0,1.6fr)_repeat(4,1fr)] items-center border-b mk-linha last:border-b-0">
            <span className="mk-t-2 font-semibold">{t.nome}</span>
            {t.liga.map((ligado, i) => (
              <span key={acoes[i]} className="flex justify-center">
                <span
                  className={cn(
                    "mk-w-5 mk-h-2.5 relative block rounded-full transition-colors",
                    ligado ? "bg-[var(--mk-acento)]" : "bg-[var(--mk-sup-2)]",
                  )}
                >
                  <span
                    className={cn(
                      "mk-size-2 absolute top-1/2 block -translate-y-1/2 rounded-full bg-[var(--mk-bg)] shadow-[0_1px_2px_rgb(0_0_0/0.2)]",
                      ligado ? "right-[calc(var(--u)*0.25)]" : "left-[calc(var(--u)*0.25)]",
                    )}
                  />
                </span>
              </span>
            ))}
          </div>
        ))}
      </CascaDoErp>
    </MockTela>
  );
}

/** O painel do dia no celular, com a barra de navegação embaixo. */
export function TelaPainelNoCelular({ className }: TelaProps) {
  const kpis = [
    { rotulo: "Vendido no mês", valor: TOTAL_DEMO },
    { rotulo: "Em negociação", valor: 36600 },
    { rotulo: "A receber", valor: A_RECEBER },
    { rotulo: "Vence hoje", valor: PARCELAS_DEMO[1].valor },
  ];
  const abas = [
    { nome: "Painel", icone: LayoutDashboard, ativa: true },
    { nome: "Propostas", icone: FileText },
    { nome: "Agenda", icone: CalendarDays },
    { nome: "Mais", icone: Menu },
  ];
  return (
    <MockTela escala="celular" className={className} data-tela="painel-celular">
      <BarraDoCelular />
      <div className="mk-px-4 min-h-0 flex-1 pt-[calc(var(--u)*2)]">
        <div className="mk-t-1 mk-suave mk-mt-2">Bom dia</div>
        <div className="mk-t-5 font-bold">Painel</div>
        <div className="mk-gap-2 mk-mt-3 grid grid-cols-2">
          {kpis.map((k) => (
            <MockBloco key={k.rotulo} className="mk-p-2">
              <div className="mk-t-1 mk-suave">{k.rotulo}</div>
              <MockValor valor={k.valor} className="mk-t-3 block font-bold" />
            </MockBloco>
          ))}
        </div>
        <div className="mk-t-1 mk-tenue mk-mt-4 font-semibold uppercase tracking-[0.06em]">Precisa de atenção</div>
        <MockLinhaDeLista
          titulo="Aceite a confirmar"
          detalhe={CLIENTE_DEMO}
          fim={<MockChip tom="atencao">Hoje</MockChip>}
        />
        <MockLinhaDeLista
          titulo="Pedido de mudança"
          detalhe="Home theater da sala"
          fim={<MockChip>Novo</MockChip>}
        />
        <MockLinhaDeLista
          titulo="Visita técnica"
          detalhe="Qui, 09:00 · Diego Lima"
          fim={<Check className="mk-size-2.5 mk-acento" aria-hidden strokeWidth={3} />}
        />
      </div>
      <nav className="mk-px-2 mk-py-2 grid shrink-0 grid-cols-4 border-t mk-linha mk-sup">
        {abas.map(({ nome, icone: Icone, ativa }) => (
          <span key={nome} className={cn("mk-gap-0.5 flex flex-col items-center", ativa ? "mk-acento" : "mk-tenue")}>
            <Icone className="mk-size-3" aria-hidden />
            <span className="mk-t-1 font-semibold">{nome}</span>
          </span>
        ))}
      </nav>
    </MockTela>
  );
}
