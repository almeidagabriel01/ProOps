import React from "react";
import { ArrowUpRight, Check, CornerDownLeft, FileDown, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  CENARIOS_DEMO,
  CLIENTE_DEMO,
  CODIGO_DEMO,
  EMPRESA_DEMO,
  GRUPOS_DEMO,
  PARCELAS_DEMO,
  TITULO_DEMO,
  TOTAL_DEMO,
} from "../dados";
import {
  MockAvatar,
  MockBloco,
  MockBotao,
  MockChip,
  MockEtapas,
  MockGrafico,
  MockLinhaDeLista,
  MockTela,
  MockValor,
} from "../pecas";
import { CascaDoErp } from "./comum";
import { checklistDaEtapa, type EtapaDaTela } from "./telas-do-cliente";

/**
 * O ERP por dentro, em tamanho de desktop: as telas que a EMPRESA usa. Cada uma
 * é uma réplica simplificada da tela real, com os nomes que ela tem no menu.
 */

interface TelaDoErpProps {
  className?: string;
}

/** Financeiro › Fluxo de caixa: saldo projetado nos três cenários. */
export function TelaFluxoDeCaixa({ className }: TelaDoErpProps) {
  const meses = ["out", "nov", "dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set"];
  const aReceber = PARCELAS_DEMO.filter((p) => p.estado === "aberto").reduce((s, p) => s + p.valor, 0);
  return (
    <MockTela className={className} data-tela="fluxo">
      <CascaDoErp
        ativo="Financeiro"
        titulo="Fluxo de caixa"
        acoes={
          <span className="mk-gap-1 flex">
            {(["Pessimista", "Realista", "Otimista"] as const).map((c) => (
              <MockChip key={c} tom={c === "Realista" ? "acento" : "neutro"}>
                {c}
              </MockChip>
            ))}
          </span>
        }
      >
        <div className="mk-gap-2 grid grid-cols-3">
          {[
            { rotulo: "Saldo nas carteiras", valor: 42180 },
            { rotulo: "A receber", valor: aReceber },
            { rotulo: "A pagar", valor: 9340 },
          ].map((kpi) => (
            <MockBloco key={kpi.rotulo}>
              <div className="mk-t-1 mk-suave">{kpi.rotulo}</div>
              <MockValor valor={kpi.valor} className="mk-t-4 block font-bold" data-mk="kpi" />
            </MockBloco>
          ))}
        </div>
        <MockBloco className="mk-mt-2" titulo="Saldo projetado, 12 meses">
          <div className="mk-h-26">
            <MockGrafico
              series={[
                { id: "pessimista", valores: CENARIOS_DEMO.pessimista, tom: "tenue", tracejada: true },
                { id: "otimista", valores: CENARIOS_DEMO.otimista, tom: "tenue", tracejada: true },
                { id: "realista", valores: CENARIOS_DEMO.realista, tom: "acento", area: true },
              ]}
            />
          </div>
          <div className="mk-t-1 mk-tenue mk-mt-1 flex justify-between">
            {meses.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </MockBloco>
      </CascaDoErp>
    </MockTela>
  );
}

/** A Lia: o pedido, a confirmação e o lançamento já baixado. */
export function TelaLia({ className }: TelaDoErpProps) {
  const parcela = PARCELAS_DEMO[1];
  return (
    <MockTela className={className} data-tela="lia">
      <CascaDoErp ativo="Financeiro" titulo="Lançamentos">
        <div className="mk-gap-3 grid h-full grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {PARCELAS_DEMO.map((p, i) => (
              <MockLinhaDeLista
                key={p.rotulo}
                titulo={`${p.rotulo} · ${CLIENTE_DEMO}`}
                detalhe={`Vencimento ${p.vencimento}`}
                data-mk={i === 1 ? "linha-alvo" : undefined}
                fim={
                  <span className="mk-gap-1 flex items-center">
                    <MockValor valor={p.valor} className="mk-t-1 font-semibold" />
                    {p.estado === "pago" ? (
                      <MockChip tom="positivo">Pago</MockChip>
                    ) : i === 1 ? (
                      <span className="relative">
                        <MockChip tom="atencao" data-mk="status-aberto">Pendente</MockChip>
                        <MockChip tom="positivo" data-mk="status-pago" className="absolute right-0 top-0 opacity-0">
                          Pago
                        </MockChip>
                      </span>
                    ) : (
                      <MockChip tom="atencao">Pendente</MockChip>
                    )}
                  </span>
                }
              />
            ))}
          </div>
          <div className="mk-rounded-2 mk-p-2 mk-gap-2 mk-sup flex flex-col border mk-linha">
            <div className="mk-gap-1 mk-t-2 flex items-center font-bold">
              <Sparkles className="mk-size-2.5 mk-acento" aria-hidden />
              Lia
            </div>
            <div
              data-mk="pedido"
              className="mk-t-2 mk-px-2 mk-py-1.5 mk-rounded-2 mk-fundo-acento max-w-[85%] self-end"
            >
              A {CLIENTE_DEMO.split(" ")[0]} pagou a parcela 2. Dá baixa pra mim?
            </div>
            <div data-mk="confirmacao" className="mk-rounded-2 mk-p-2 border mk-linha bg-[var(--mk-bg)]">
              <div className="mk-t-1 mk-suave">Marcar como pago</div>
              <div className="mk-t-2 font-semibold">
                {parcela.rotulo} · <MockValor valor={parcela.valor} />
              </div>
              <div className="mk-gap-1 mk-mt-1.5 flex">
                <MockBotao data-mk="confirmar" className="mk-gap-1">
                  <Check className="mk-size-2" aria-hidden strokeWidth={3} />
                  Confirmar
                </MockBotao>
                <MockBotao variante="contorno">Cancelar</MockBotao>
              </div>
            </div>
            <div data-mk="resposta" className="mk-t-2 mk-suave">
              Pronto. Lancei como pago na carteira principal.
            </div>
            <div className="mk-gap-1 mk-p-1.5 mk-rounded-1.5 mk-t-1 mk-tenue mt-auto flex items-center border mk-linha bg-[var(--mk-bg)]">
              Pergunte ou peça algo
              <CornerDownLeft className="mk-size-2 ml-auto" aria-hidden />
            </div>
          </div>
        </div>
      </CascaDoErp>
    </MockTela>
  );
}

/** CRM › Leads: o funil antes da proposta. */
export function TelaLeads({ className }: TelaDoErpProps) {
  const colunas = [
    { nome: "Novo", leads: [{ nome: "Rafael Souza", valor: 9200, origem: "Instagram" }, { nome: "Clínica Vita", valor: 24000, origem: "Indicação" }] },
    { nome: "Em contato", leads: [{ nome: "Júlia Prado", valor: 12600, origem: "Site" }] },
    { nome: "Qualificado", leads: [{ nome: CLIENTE_DEMO, valor: TOTAL_DEMO, origem: "Arquiteto", alvo: true }] },
    { nome: "Convertido", leads: [{ nome: "Casa Ipê", valor: 31800, origem: "Indicação" }] },
  ];
  return (
    <MockTela className={className} data-tela="leads">
      <CascaDoErp ativo="CRM" titulo="Leads" acoes={<MockBotao>Novo lead</MockBotao>}>
        <div className="mk-gap-2 grid h-full grid-cols-4">
          {colunas.map((coluna) => (
            <div key={coluna.nome} className="mk-rounded-2 mk-p-1.5 mk-sup mk-gap-1.5 flex flex-col">
              <div className="mk-t-1 flex justify-between font-semibold">
                {coluna.nome}
                <span className="mk-tenue">{coluna.leads.length}</span>
              </div>
              {coluna.leads.map((lead) => (
                <div
                  key={lead.nome}
                  data-mk={"alvo" in lead ? "lead-alvo" : "lead"}
                  className={cn(
                    "mk-rounded-1.5 mk-p-1.5 border bg-[var(--mk-bg)]",
                    "alvo" in lead ? "border-[var(--mk-acento)]" : "mk-linha",
                  )}
                >
                  <div className="mk-t-2 truncate font-semibold">{lead.nome}</div>
                  <div className="mk-t-1 mk-suave">{lead.origem}</div>
                  <MockValor valor={lead.valor} className="mk-t-1 font-semibold" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </CascaDoErp>
    </MockTela>
  );
}

/** Notas fiscais: a NF-e autorizada, com PDF e XML. */
export function TelaNotaFiscal({ className }: TelaDoErpProps) {
  const chave = "3526 0912 3456 7800 0190 5500 1000 0012 8410 0012 8412";
  return (
    <MockTela className={className} data-tela="nota">
      <CascaDoErp
        ativo="Notas"
        titulo="NF-e 1.284"
        acoes={
          <span className="mk-gap-1 flex">
            <MockBotao variante="contorno" className="mk-gap-1">
              <FileDown className="mk-size-2" aria-hidden />
              PDF
            </MockBotao>
            <MockBotao variante="contorno" className="mk-gap-1">
              <FileDown className="mk-size-2" aria-hidden />
              XML
            </MockBotao>
          </span>
        }
      >
        <div className="mk-gap-2 grid grid-cols-2">
          <MockBloco titulo="Emitente">
            <div className="mk-t-2 font-semibold">{EMPRESA_DEMO}</div>
            <div className="mk-t-1 mk-suave">CNPJ 12.345.678/0001-90</div>
          </MockBloco>
          <MockBloco titulo="Destinatário">
            <div className="mk-t-2 font-semibold">{CLIENTE_DEMO}</div>
            <div className="mk-t-1 mk-suave">CPF •••.482.•••-10</div>
          </MockBloco>
        </div>
        <MockBloco className="mk-mt-2" titulo="Itens">
          {GRUPOS_DEMO.map((g) => (
            <MockLinhaDeLista
              key={g.nome}
              titulo={g.nome}
              detalhe={`Proposta ${CODIGO_DEMO}`}
              fim={<MockValor valor={g.subtotal} className="mk-t-1 font-semibold" />}
            />
          ))}
        </MockBloco>
        <div className="mk-mt-2 mk-gap-2 flex items-end justify-between">
          <div className="min-w-0">
            <div className="mk-t-1 mk-tenue">Chave de acesso</div>
            <div className="mk-t-1 truncate font-mono tabular-nums">{chave}</div>
          </div>
          <span
            data-mk="carimbo"
            className="mk-t-2 mk-px-2 mk-py-1 mk-rounded-1 shrink-0 -rotate-6 border-2 border-[var(--mk-positivo)] font-black uppercase tracking-[0.08em] text-[var(--mk-positivo)]"
          >
            Autorizada
          </span>
        </div>
      </CascaDoErp>
    </MockTela>
  );
}

/** Obras: o projeto de instalação visto pela equipe. */
export function TelaObraInterna({ etapas, className }: TelaDoErpProps & { etapas: readonly EtapaDaTela[] }) {
  return (
    <MockTela className={className} data-tela="obra-interna">
      <CascaDoErp
        ativo="Obras"
        titulo={TITULO_DEMO}
        acoes={<MockBotao variante="contorno">Link da entrega</MockBotao>}
      >
        <MockEtapas etapas={etapas} />
        <div className="mk-gap-2 mk-mt-3 grid grid-cols-[1.3fr_1fr]">
          <MockBloco titulo="Checklist da etapa">
            {checklistDaEtapa(etapas).map(({ item, feito }) => (
              <div key={item} data-mk="check" className="mk-gap-1.5 mk-py-0.5 mk-t-2 flex items-start">
                <span
                  className={cn(
                    "mk-size-2.5 mk-rounded-0.5 mt-[0.15em] grid shrink-0 place-items-center border",
                    feito ? "mk-fundo-acento border-transparent" : "mk-linha",
                  )}
                >
                  {feito ? <Check className="mk-size-2" aria-hidden strokeWidth={3} /> : null}
                </span>
                <span className={feito ? "" : "mk-suave"}>{item}</span>
              </div>
            ))}
          </MockBloco>
          <div className="mk-gap-2 flex flex-col">
            <MockBloco titulo="Responsável">
              <div className="mk-gap-1.5 flex items-center">
                <MockAvatar nome="Diego Lima" />
                <span className="mk-t-2 font-semibold">Diego Lima</span>
              </div>
            </MockBloco>
            <MockBloco titulo="Visita marcada" data-mk="visita">
              <div className="mk-t-2 font-semibold">Qui, 09:00 às 12:00</div>
              <div className="mk-t-1 mk-suave mk-gap-1 flex items-center">
                Na Agenda e no Google Agenda
                <ArrowUpRight className="mk-size-2" aria-hidden />
              </div>
            </MockBloco>
          </div>
        </div>
      </CascaDoErp>
    </MockTela>
  );
}

/** O PDF da proposta, como sai para o cliente. */
export function TelaDocumento({ className }: TelaDoErpProps) {
  return (
    <MockTela className={cn("mk-p-5", className)} data-tela="documento">
      <div className="mk-rounded-1 flex h-full flex-col bg-[var(--mk-bg)]">
        <div className="mk-gap-2 flex items-start justify-between border-b-2 border-[var(--mk-acento)] pb-[calc(var(--u)*2)]">
          <div>
            <div className="mk-t-1 mk-tenue font-semibold uppercase tracking-[0.1em]">Proposta comercial</div>
            <div className="mk-t-5 font-bold">{TITULO_DEMO}</div>
            <div className="mk-t-1 mk-suave">
              {CLIENTE_DEMO} · {CODIGO_DEMO}
            </div>
          </div>
          <span className="mk-size-8 mk-rounded-1.5 mk-t-3 mk-fundo-acento grid place-items-center font-bold">
            {EMPRESA_DEMO[0]}
          </span>
        </div>
        <div className="mk-mt-2">
          {GRUPOS_DEMO.map((g) => (
            <div key={g.nome} className="mk-py-1.5 border-b mk-linha" data-mk="grupo">
              <div className="flex justify-between">
                <span className="mk-t-2 font-semibold">{g.nome}</span>
                <MockValor valor={g.subtotal} className="mk-t-2 font-semibold" />
              </div>
              <div className="mk-gap-1 mk-mt-1 flex">
                {Array.from({ length: g.itens }, (_, i) => (
                  <span key={i} className="mk-h-1 mk-rounded-0.5 block flex-1 bg-[var(--mk-sup-2)]" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mk-mt-3">
          <div className="mk-t-1 mk-tenue font-semibold uppercase tracking-[0.1em]">Condições de pagamento</div>
          <div className="mk-gap-2 mk-mt-1 grid grid-cols-3">
            {PARCELAS_DEMO.map((p) => (
              <div key={p.rotulo} className="mk-p-1.5 mk-rounded-1 mk-sup">
                <div className="mk-t-1 mk-suave">{p.rotulo}</div>
                <MockValor valor={p.valor} className="mk-t-2 font-semibold" />
                <div className="mk-t-1 mk-tenue">Vence {p.vencimento}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto flex items-baseline justify-between pt-[calc(var(--u)*2)]">
          <span className="mk-t-2 mk-suave">Investimento total</span>
          <MockValor valor={TOTAL_DEMO} className="mk-t-6 font-bold" data-mk="total" />
        </div>
      </div>
    </MockTela>
  );
}
