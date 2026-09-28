import React from "react";
import { CalendarDays, Check, Copy, FileText, ImageIcon, Receipt } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  CLIENTE_DEMO,
  CODIGO_DEMO,
  GRUPOS_DEMO,
  PARCELAS_DEMO,
  TITULO_DEMO,
  TOTAL_DEMO,
} from "../dados";
import {
  MockAssinatura,
  MockBloco,
  MockBotao,
  MockChip,
  MockEtapas,
  MockLinhaDeLista,
  MockQr,
  MockTela,
  MockValor,
  type EstadoDaEtapa,
} from "../pecas";
import { BarraDoCelular, TopoDoLink } from "./comum";

/**
 * As seis páginas que a empresa manda ao cliente final e ao contador, em
 * tamanho de celular. Cada uma é a réplica da página pública de verdade
 * (`app/share/**`), com os rótulos de lá: "Aceitar proposta", "Solicitar
 * mudanças", "Copiar código PIX", "Pedir a visita", "Aceitar a entrega".
 */

interface TelaDoClienteProps {
  className?: string;
}

/** `/share/[token]`: a proposta, com aceite e pedido de mudanças. */
export function TelaPropostaLink({ className, assinada = true }: TelaDoClienteProps & { assinada?: boolean }) {
  return (
    <MockTela escala="celular" className={className} data-tela="proposta">
      <BarraDoCelular />
      <TopoDoLink pagina="Proposta comercial" />
      <div className="mk-p-4 mk-gap-3 flex min-h-0 flex-1 flex-col">
        <div>
          <MockChip>{CODIGO_DEMO}</MockChip>
          <div className="mk-t-4 mk-mt-1.5 font-bold">{TITULO_DEMO}</div>
          <div className="mk-t-1 mk-suave">Para {CLIENTE_DEMO}</div>
        </div>
        <div>
          {GRUPOS_DEMO.map((grupo) => (
            <MockLinhaDeLista
              key={grupo.nome}
              titulo={grupo.nome}
              detalhe={`${grupo.itens} itens`}
              fim={<MockValor valor={grupo.subtotal} className="mk-t-2 font-semibold" />}
            />
          ))}
        </div>
        <div className="flex items-baseline justify-between">
          <span className="mk-t-2 mk-suave">Total</span>
          <MockValor valor={TOTAL_DEMO} className="mk-t-5 font-bold" data-mk="total" />
        </div>
        <div className="mk-t-1 mk-suave">Entrada e 2 parcelas, no boleto ou no Pix</div>
        <div className="mt-auto">
          <div className={cn("mk-p-2 mk-rounded-2 border mk-linha", !assinada && "hidden")} data-mk="aceite">
            <MockAssinatura className="mk-h-8 w-[70%] text-[var(--mk-texto)]" />
            <div className="mk-t-1 mk-suave mk-mt-0.75 border-t mk-linha pt-[calc(var(--u)*0.75)]">
              {CLIENTE_DEMO} · CPF •••.482.•••-10
            </div>
          </div>
          <div className="mk-gap-1.5 mk-mt-2 grid grid-cols-2">
            <MockBotao variante="contorno">Solicitar mudanças</MockBotao>
            <MockBotao data-mk="aceitar">Aceitar proposta</MockBotao>
          </div>
        </div>
      </div>
    </MockTela>
  );
}

/** `/share/transaction/[token]`: a parcela, com o Pix e o boleto. */
export function TelaRecibo({ className }: TelaDoClienteProps) {
  const parcela = PARCELAS_DEMO[1];
  return (
    <MockTela escala="celular" className={className} data-tela="recibo">
      <BarraDoCelular />
      <TopoDoLink pagina="Recibo e pagamento" />
      <div className="mk-p-4 mk-gap-3 flex min-h-0 flex-1 flex-col">
        <div className="flex items-start justify-between">
          <div>
            <div className="mk-t-2 mk-suave">{parcela.rotulo}</div>
            <MockValor valor={parcela.valor} className="mk-t-6 block font-bold" />
            <div className="mk-t-1 mk-suave">Vence em {parcela.vencimento}</div>
          </div>
          <span className="relative">
            <MockChip tom="atencao" data-mk="status-aberto">A vencer</MockChip>
            <MockChip tom="positivo" data-mk="status-pago" className="absolute right-0 top-0 opacity-0">
              Pago
            </MockChip>
          </span>
        </div>
        <div className="mk-p-3 mk-rounded-2 mk-sup mk-gap-2 flex flex-col items-center">
          <MockQr semente={CODIGO_DEMO} className="mk-size-28 mk-rounded-1 overflow-hidden" />
          <MockBotao variante="contorno" className="w-full mk-gap-1">
            <Copy className="mk-size-2.5" aria-hidden />
            Copiar código PIX
          </MockBotao>
        </div>
        <MockLinhaDeLista
          titulo="Boleto"
          detalhe="Copiar linha digitável"
          fim={<Receipt className="mk-size-3 mk-suave" aria-hidden />}
        />
        <div className="mk-t-1 mk-suave mt-auto text-center">
          Pago pelo link, a baixa entra sozinha no financeiro da empresa
        </div>
      </div>
    </MockTela>
  );
}

export interface EtapaDaTela {
  nome: string;
  estado: EstadoDaEtapa;
}

/** `/share/project/[token]`: a obra, etapa por etapa, e o aceite da entrega. */
export function TelaEntregaObra({ etapas, className }: TelaDoClienteProps & { etapas: readonly EtapaDaTela[] }) {
  const atual = etapas.find((e) => e.estado === "atual") ?? etapas[etapas.length - 1];
  return (
    <MockTela escala="celular" className={className} data-tela="obra">
      <BarraDoCelular />
      <TopoDoLink pagina="Entrega da obra" />
      <div className="mk-p-4 mk-gap-3 flex min-h-0 flex-1 flex-col">
        <div>
          <div className="mk-t-4 font-bold">{TITULO_DEMO}</div>
          <div className="mk-t-1 mk-suave">Etapa atual: {atual.nome}</div>
        </div>
        <MockEtapas etapas={etapas} />
        <MockBloco titulo="Checklist">
          {["Pontos conferidos", "Equipamentos instalados", "Teste com o cliente"].map((item, i) => (
            <div key={item} className="mk-gap-1.5 mk-py-0.5 mk-t-2 flex items-center" data-mk="check">
              <span
                className={cn(
                  "mk-size-3 mk-rounded-0.5 grid place-items-center border",
                  i < 2 ? "mk-fundo-acento border-transparent" : "mk-linha",
                )}
              >
                {i < 2 ? <Check className="mk-size-2" aria-hidden strokeWidth={3} /> : null}
              </span>
              <span className={i < 2 ? "" : "mk-suave"}>{item}</span>
            </div>
          ))}
        </MockBloco>
        <div className="mk-gap-1.5 grid grid-cols-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              data-mk="foto"
              className="mk-rounded-1.5 mk-sup grid aspect-square place-items-center border mk-linha"
            >
              <ImageIcon className="mk-size-3.5 mk-tenue" aria-hidden />
            </span>
          ))}
        </div>
        <div className="mk-t-1 mk-suave mk-gap-1 flex items-center">
          <CalendarDays className="mk-size-2.5" aria-hidden />
          Próxima visita: qui, 09:00 às 12:00
        </div>
        <MockBotao className="mt-auto w-full">Aceitar a entrega</MockBotao>
      </div>
    </MockTela>
  );
}

/** `/share/visita/[token]`: o cliente escolhe o horário da visita. */
export function TelaAgendamento({
  tipoDeVisita,
  className,
}: TelaDoClienteProps & { tipoDeVisita: string }) {
  const dias = ["seg 6", "ter 7", "qua 8", "qui 9", "sex 10"];
  const horarios = [
    { periodo: "Manhã", horas: ["08:00", "10:00"] },
    { periodo: "Tarde", horas: ["14:00", "16:00"] },
  ];
  return (
    <MockTela escala="celular" className={className} data-tela="agendamento">
      <BarraDoCelular />
      <TopoDoLink pagina="Agende uma visita" />
      <div className="mk-p-4 mk-gap-3 flex min-h-0 flex-1 flex-col">
        <div>
          <div className="mk-t-1 mk-tenue font-semibold uppercase tracking-[0.06em]">Tipo de visita</div>
          <div className="mk-gap-1 mk-mt-1 flex flex-wrap">
            <MockChip tom="acento">{tipoDeVisita} · 1 h</MockChip>
          </div>
        </div>
        <div className="mk-gap-1 grid grid-cols-5">
          {dias.map((dia, i) => (
            <span
              key={dia}
              className={cn(
                "mk-rounded-1.5 mk-py-1.5 mk-t-1 flex flex-col items-center border",
                i === 3 ? "mk-fundo-acento border-transparent font-bold" : "mk-linha",
              )}
            >
              {dia.split(" ").map((parte) => (
                <span key={parte}>{parte}</span>
              ))}
            </span>
          ))}
        </div>
        {horarios.map(({ periodo, horas }) => (
          <div key={periodo}>
            <div className="mk-t-1 mk-suave">{periodo}</div>
            <div className="mk-gap-1 mk-mt-1 grid grid-cols-2">
              {horas.map((hora) => (
                <span
                  key={hora}
                  data-mk={hora === "10:00" ? "horario" : undefined}
                  className={cn(
                    "mk-rounded-1.5 mk-py-1.5 mk-t-2 border text-center font-semibold",
                    hora === "10:00" ? "border-[var(--mk-acento)] mk-acento" : "mk-linha",
                  )}
                >
                  {hora}
                </span>
              ))}
            </div>
          </div>
        ))}
        <MockBotao className="mt-auto w-full">Pedir a visita</MockBotao>
        <div className="mk-t-1 mk-suave text-center">A empresa confirma e você recebe um e-mail</div>
      </div>
    </MockTela>
  );
}

/** `/share/portal/[token]`: tudo do cliente numa página só. */
export function TelaPortal({ className }: TelaDoClienteProps) {
  return (
    <MockTela escala="celular" className={className} data-tela="portal">
      <BarraDoCelular />
      <TopoDoLink pagina="Seu portal" />
      <div className="mk-p-4 mk-gap-2.5 flex min-h-0 flex-1 flex-col">
        <div>
          <div className="mk-t-4 font-bold">Olá, {CLIENTE_DEMO.split(" ")[0]}</div>
          <div className="mk-t-1 mk-suave">Você tem 2 pagamentos em aberto.</div>
        </div>
        <MockBloco titulo="Propostas">
          <MockLinhaDeLista
            titulo={TITULO_DEMO}
            detalhe={<MockChip tom="positivo">Aprovada</MockChip>}
            fim={<MockValor valor={TOTAL_DEMO} className="mk-t-1 font-semibold" />}
          />
        </MockBloco>
        <MockBloco titulo="Pagamentos">
          {PARCELAS_DEMO.map((p) => (
            <MockLinhaDeLista
              key={p.rotulo}
              titulo={p.rotulo}
              detalhe={
                <>
                  <MockChip tom={p.estado === "pago" ? "positivo" : "neutro"}>
                    {p.estado === "pago" ? "Pago" : "A vencer"}
                  </MockChip>
                  <MockValor valor={p.valor} />
                </>
              }
              fim={
                p.estado === "pago" ? (
                  <MockBotao variante="contorno" className="mk-t-1">Recibo</MockBotao>
                ) : (
                  <MockBotao className="mk-t-1">Pagar</MockBotao>
                )
              }
            />
          ))}
        </MockBloco>
        <MockBloco titulo="Obra">
          <div className="mk-t-2 font-semibold">Em andamento: 2 de 4 etapas</div>
          <span className="mk-h-0.75 mk-rounded-1 mk-mt-1 block w-full bg-[var(--mk-sup-2)]">
            <span className="mk-rounded-1 block h-full w-1/2 bg-[var(--mk-acento)]" />
          </span>
        </MockBloco>
        <MockBloco titulo="Notas fiscais" className="mk-gap-1 flex flex-col">
          <MockLinhaDeLista titulo="NF-e 1.284" detalhe="Autorizada" fim={<FileText className="mk-size-3 mk-suave" aria-hidden />} />
        </MockBloco>
      </div>
    </MockTela>
  );
}

/** `/share/contador/[token]`: o DRE e as notas, só leitura, sem login. */
export function TelaContador({ className }: TelaDoClienteProps) {
  const linhas = [
    { rotulo: "Receita bruta", valor: 96400, forte: true },
    { rotulo: "Impostos", valor: -8676 },
    { rotulo: "Custos", valor: -38560 },
    { rotulo: "Despesas", valor: -21300 },
  ];
  const resultado = linhas.reduce((soma, l) => soma + l.valor, 0);
  return (
    <MockTela escala="celular" className={className} data-tela="contador">
      <BarraDoCelular />
      <TopoDoLink pagina="Acesso do contador" />
      <div className="mk-p-4 mk-gap-3 flex min-h-0 flex-1 flex-col">
        <div className="mk-gap-1 flex">
          {["DRE", "Lançamentos", "Notas emitidas"].map((aba, i) => (
            <span
              key={aba}
              className={cn(
                "mk-t-1 mk-px-1.5 mk-py-1 mk-rounded-1 font-semibold",
                i === 0 ? "mk-fundo-acento" : "mk-sup mk-suave",
              )}
            >
              {aba}
            </span>
          ))}
        </div>
        <div className="mk-t-1 mk-suave">Jul a set · regime de caixa</div>
        <div>
          {linhas.map((l) => (
            <MockLinhaDeLista
              key={l.rotulo}
              titulo={l.rotulo}
              fim={
                <MockValor
                  valor={l.valor}
                  className={cn("mk-t-2", l.forte ? "font-bold" : "mk-suave")}
                />
              }
            />
          ))}
        </div>
        <div className="mk-p-2 mk-rounded-2 mk-sup flex items-baseline justify-between">
          <span className="mk-t-2 font-semibold">Resultado</span>
          <MockValor valor={resultado} className="mk-t-5 font-bold" data-mk="resultado" />
        </div>
        <div className="mk-gap-1.5 mt-auto grid grid-cols-2">
          <MockBotao variante="contorno">Excel</MockBotao>
          <MockBotao variante="contorno">CSV</MockBotao>
        </div>
      </div>
    </MockTela>
  );
}
