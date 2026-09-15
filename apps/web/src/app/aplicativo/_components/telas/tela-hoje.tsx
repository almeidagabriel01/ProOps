import React from "react";

import { cn } from "@/lib/utils";

import {
  Atalho,
  BarraDeStatus,
  CabecalhoApp,
  Dinheiro,
  LinhaPendencia,
  PainelDestaque,
  RotuloSecao,
  Sparkline,
  TabBar,
  TelaApp,
} from "./pecas";

/**
 * A aba Hoje, reconstruída.
 *
 * A anatomia e a ordem vertical saem do `docs/design/hoje.md` do aplicativo, que
 * também registra o porquê de cada posição: o painel de destaque responde a
 * pergunta que mais gente tem ("posso gastar?"), e o que vence vem logo abaixo
 * porque é a única coisa da tela com consequência se for ignorada.
 *
 * Os números NÃO vieram da captura de desenvolvimento, e isso é deliberado. Ela
 * mostra uma sobra de R$ 37.812,70 com aluguel atrasado, que é dado de seed e
 * não se sustenta como história. A página inteira passa a contar uma só: a mesma
 * sobra que a cena "Um dia" diz às 22h, e as mesmas duas contas que ela anuncia
 * às 7h40.
 *
 * Nenhum nome de banco real aparece. A captura interna traz um, e numa página
 * pública o nome de um emissor sugere integração que não existe.
 */

/** A projeção do mês, já normalizada em 0..1 (1 é o topo do gráfico). */
const PROJECAO = [1, 0.93, 0.79, 0.76, 0.61, 0.56, 0.44, 0.4];

export interface DadosHoje {
  hora: string;
  saudacao: string;
  rotuloDestaque: string;
  sobra: string;
  linhaSecundaria: string;
  atalhos: ReadonlyArray<{ rotulo: string; contagem: number }>;
  rotuloPendencias: string;
  totalPendencias: string;
  pendencias: ReadonlyArray<{
    titulo: string;
    venceu: string;
    valor: string;
    acao?: string;
  }>;
}

export const HOJE_PADRAO: DadosHoje = {
  hora: "07:41",
  saudacao: "Bom dia, Gabriel",
  rotuloDestaque: "Sobra até o fim do mês",
  sobra: "R$ 1.284,90",
  linhaSecundaria: "18 dias até virar o mês · Projeção positiva",
  atalhos: [
    { rotulo: "Vencendo", contagem: 2 },
    { rotulo: "Lembretes", contagem: 3 },
    { rotulo: "Orçamento", contagem: 1 },
  ],
  rotuloPendencias: "Vence hoje",
  totalPendencias: "2 contas",
  pendencias: [
    {
      titulo: "Fatura do cartão",
      venceu: "vence hoje",
      valor: "R$ 1.350,00",
      acao: "Pagar",
    },
    {
      titulo: "Aluguel",
      venceu: "vence hoje",
      valor: "R$ 1.900,00",
      acao: "Paguei",
    },
  ],
};

/**
 * A entrada em CSS puro de um elemento da tela.
 *
 * Devolve `className` e `style` juntos porque os dois são a mesma decisão, e
 * separá-los é como se escreve um elemento que anima sem atraso nenhum por
 * engano. `undefined` quando a tela está parada, para o `cn` simplesmente
 * ignorar.
 *
 * Só o herói liga isto. Acima da dobra a animação não pode depender de
 * biblioteca: um `initial={{ opacity: 0 }}` seguraria o conteúdo invisível até o
 * bundle hidratar, que num celular estrangulado é vários segundos. `.hero-enter`
 * e `.traco-desenha` tocam sozinhas no primeiro paint e já declaram o estado
 * final sob `prefers-reduced-motion`.
 */
function entrada(
  ligada: boolean,
  atraso: number,
  y = "10px",
): { className?: string; style?: React.CSSProperties } {
  if (!ligada) return {};
  return {
    className: "hero-enter",
    style: {
      "--hero-y": y,
      "--hero-delay": `${atraso}s`,
      "--hero-dur": "0.55s",
    } as React.CSSProperties,
  };
}

interface TelaHojeProps {
  dados?: DadosHoje;
  /** Liga a entrada em CSS. Só o herói usa; ver `entrada` acima. */
  animada?: boolean;
}

export function TelaHoje({
  dados = HOJE_PADRAO,
  animada = false,
}: TelaHojeProps) {
  const saudacao = entrada(animada, 0.45);
  const painel = entrada(animada, 0.55, "14px");
  const atalhos = entrada(animada, 0.68);
  const pendencias = entrada(animada, 0.8);

  return (
    <TelaApp>
      <BarraDeStatus hora={dados.hora} />
      <CabecalhoApp />

      <div className="min-h-0 flex-1 overflow-hidden px-[5cqw] pt-[4cqw]">
        <h3
          className={cn(
            saudacao.className,
            "text-[5.6cqw] font-bold leading-tight tracking-[-0.02em]",
          )}
          style={saudacao.style}
        >
          {dados.saudacao}
        </h3>

        <div className={painel.className} style={painel.style}>
          <PainelDestaque className="mt-[3.4cqw]">
            <p className="text-[2.9cqw] font-semibold uppercase tracking-[0.2em] text-[var(--app-on-hero-muted)]">
              {dados.rotuloDestaque}
            </p>
            <Dinheiro className="mt-[2cqw] block text-[9cqw] font-bold leading-none">
              {dados.sobra}
            </Dinheiro>
            <p className="mt-[2.4cqw] text-[3.1cqw] leading-snug text-[var(--app-tint)]">
              {dados.linhaSecundaria}
            </p>
            <div className="mt-[3cqw]">
              <Sparkline pontos={PROJECAO} desenha={animada} atrasoSegundos={1} />
            </div>
            <div
              aria-hidden="true"
              className="mt-[1.4cqw] flex items-center justify-between text-[2.7cqw] text-[var(--app-on-hero-muted)]"
            >
              <span>Hoje</span>
              <span>Dia 30</span>
            </div>
          </PainelDestaque>
        </div>

        <div
          className={cn(atalhos.className, "mt-[3cqw] flex gap-[2.6cqw]")}
          style={atalhos.style}
        >
          {dados.atalhos.map((atalho) => (
            <Atalho key={atalho.rotulo} {...atalho} />
          ))}
        </div>

        <div
          className={cn(pendencias.className, "mt-[4.4cqw]")}
          style={pendencias.style}
        >
          <RotuloSecao direita={dados.totalPendencias}>
            {dados.rotuloPendencias}
          </RotuloSecao>
          <div className="mt-[2.6cqw] flex flex-col gap-[2.4cqw]">
            {dados.pendencias.map((pendencia) => (
              <LinhaPendencia key={pendencia.titulo} {...pendencia} />
            ))}
          </div>
        </div>
      </div>

      <TabBar ativa="hoje" />
    </TelaApp>
  );
}
