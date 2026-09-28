import React from "react";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

import { caminhoDeArea, caminhoSuave, modulosDoQr, pontosDaSerie } from "./geometria";

/**
 * As peças das telas codadas do ERP.
 *
 * Componentes de servidor, sem hook nenhum: a tela inteira chega pronta no HTML
 * e só a cena que a anima hidrata. Tudo é medido na unidade `--u` da
 * `.mock-tela` (ver `app/vitrine.css`), então uma peça sai do tamanho certo
 * numa moldura de navegador e num celular.
 *
 * Os `data-mk` são os ganchos das cenas: uma cena procura `[data-mk="total"]`
 * dentro do próprio escopo em vez de receber refs de cada peça.
 */

type Escala = "desktop" | "celular";

interface MockTelaProps extends React.HTMLAttributes<HTMLDivElement> {
  escala?: Escala;
}

/**
 * A raiz de toda réplica. É `aria-hidden`: o que a tela demonstra é explicado
 * no texto da página ao lado dela, e um leitor de tela lendo "R$ 6.133,34 A
 * vencer Pagar" fora de contexto é ruído, não conteúdo.
 */
export function MockTela({ escala = "desktop", className, children, ...rest }: MockTelaProps) {
  return (
    <div aria-hidden="true" className="mock-caixa h-full w-full">
      <div
        data-escala={escala}
        className={cn("mock-tela relative flex h-full w-full flex-col overflow-hidden", className)}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}

type Tom = "neutro" | "positivo" | "atencao" | "acento";

const TOM_DO_CHIP: Record<Tom, string> = {
  neutro: "bg-[var(--mk-sup-2)] text-[var(--mk-suave)]",
  positivo:
    "bg-[color-mix(in_oklab,var(--mk-positivo)_14%,transparent)] text-[var(--mk-positivo)]",
  atencao:
    "bg-[color-mix(in_oklab,var(--mk-atencao)_14%,transparent)] text-[var(--mk-atencao)]",
  acento:
    "bg-[color-mix(in_oklab,var(--mk-acento)_14%,transparent)] text-[var(--mk-acento)]",
};

export function MockChip({
  tom = "neutro",
  children,
  className,
  ...rest
}: { tom?: Tom; children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "mk-t-1 mk-px-1.5 mk-rounded-1 inline-flex shrink-0 items-center whitespace-nowrap py-[0.15em] font-semibold",
        TOM_DO_CHIP[tom],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function MockBotao({
  variante = "cheio",
  children,
  className,
  ...rest
}: {
  variante?: "cheio" | "contorno";
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "mk-t-2 mk-px-2.5 mk-py-1.5 mk-rounded-1.5 inline-flex shrink-0 items-center justify-center whitespace-nowrap font-semibold",
        variante === "cheio"
          ? "mk-fundo-acento"
          : "border border-[var(--mk-linha)] text-[var(--mk-texto)]",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

export function MockValor({
  valor,
  className,
  ...rest
}: { valor: number; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("tabular-nums", className)} {...rest}>
      {formatCurrency(valor)}
    </span>
  );
}

/** Linha de lista: título e detalhe à esquerda, o que for à direita. */
export function MockLinhaDeLista({
  titulo,
  detalhe,
  fim,
  className,
  ...rest
}: {
  titulo: React.ReactNode;
  detalhe?: React.ReactNode;
  fim?: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mk-gap-2 mk-py-1.5 flex items-center border-b mk-linha last:border-b-0", className)}
      {...rest}
    >
      <div className="min-w-0 flex-1">
        <div className="mk-t-2 truncate font-semibold">{titulo}</div>
        {detalhe ? <div className="mk-t-1 mk-suave mk-gap-1 flex items-center truncate">{detalhe}</div> : null}
      </div>
      {fim}
    </div>
  );
}

/** Um bloco da tela: fundo levemente destacado, título pequeno. */
export function MockBloco({
  titulo,
  children,
  className,
  ...rest
}: { titulo?: React.ReactNode; children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mk-p-2 mk-rounded-2 border mk-linha bg-[var(--mk-bg)]", className)} {...rest}>
      {titulo ? <div className="mk-t-1 mk-tenue mb-[calc(var(--u)*1)] font-semibold uppercase tracking-[0.06em]">{titulo}</div> : null}
      {children}
    </div>
  );
}

export interface SerieDoGrafico {
  valores: readonly number[];
  /** `acento` é a série principal; `tenue` as de apoio. */
  tom?: "acento" | "tenue";
  tracejada?: boolean;
  area?: boolean;
  /** Gancho para a cena desenhar a linha. */
  id?: string;
}

/**
 * Gráfico de linhas em SVG puro. Sem Recharts de propósito: a biblioteca inteira
 * para três curvas decorativas é o tipo de peso que a página de nicho já
 * separou do próprio bundle uma vez (ver `niche-landing-page.tsx`).
 *
 * O `vector-effect` mantém a espessura do traço quando o SVG estica. Por
 * causa dele a curva NÃO leva `pathLength`: o Chrome mede o traço em unidades
 * do usuário esticadas e o desenho sai picotado. A cena revela o gráfico com
 * `clip-path` no `data-mk="grafico"`, que dá o mesmo efeito da esquerda para
 * a direita.
 */
export function MockGrafico({
  series,
  className,
  altura = 40,
}: {
  series: readonly SerieDoGrafico[];
  className?: string;
  altura?: number;
}) {
  const largura = 100;
  const todos = series.flatMap((s) => s.valores);
  const faixa = { min: Math.min(...todos), max: Math.max(...todos) };
  return (
    <svg
      data-mk="grafico"
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
      className={cn("block h-full w-full overflow-visible", className)}
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={0}
          x2={largura}
          y1={altura * f}
          y2={altura * f}
          stroke="var(--mk-linha)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {series.map((serie, i) => {
        const pontos = pontosDaSerie(serie.valores, largura, altura, faixa);
        const cor = serie.tom === "tenue" ? "var(--mk-tenue)" : "var(--mk-acento)";
        return (
          <g key={serie.id ?? i} data-mk-serie={serie.id}>
            {serie.area ? (
              <path
                d={caminhoDeArea(pontos, altura)}
                fill="color-mix(in oklab, var(--mk-acento) 10%, transparent)"
                data-mk="area"
              />
            ) : null}
            <path
              d={caminhoSuave(pontos)}
              fill="none"
              stroke={cor}
              strokeWidth={serie.tom === "tenue" ? 1.25 : 2}
              strokeDasharray={serie.tracejada ? "3 3" : undefined}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              data-mk="linha"
            />
          </g>
        );
      })}
    </svg>
  );
}

/** Barras verticais, alturas relativas ao maior valor. */
export function MockBarras({
  valores,
  destaque,
  className,
}: {
  valores: readonly number[];
  destaque?: number;
  className?: string;
}) {
  const max = Math.max(...valores, 1);
  return (
    <div className={cn("mk-gap-1 flex h-full items-end", className)}>
      {valores.map((v, i) => (
        <span
          key={i}
          data-mk="barra"
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
          className={cn(
            "mk-rounded-0.5 block flex-1 origin-bottom",
            i === destaque ? "bg-[var(--mk-acento)]" : "bg-[var(--mk-sup-2)]",
          )}
        />
      ))}
    </div>
  );
}

/**
 * Uma assinatura manuscrita, em um traço só. `pathLength="1"` para a cena
 * desenhá-la; sem cena, ela aparece inteira.
 */
export function MockAssinatura({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 64" className={cn("block overflow-visible", className)} fill="none">
      <path
        data-mk="assinatura"
        className="mk-traco"
        pathLength={1}
        d="M8 46C14 30 22 12 28 10C32 9 30 30 26 44M18 33C27 30 36 30 43 31C47 25 50 22 52 28C53 33 50 40 54 40C58 40 60 28 64 28C67 28 64 40 69 40C74 40 76 30 80 32C83 34 78 42 84 42C92 42 96 18 100 16C103 15 100 40 104 40C108 40 112 18 116 18C119 18 116 40 121 40C125 40 128 30 132 30C136 30 133 40 138 40C142 40 144 32 148 32C152 32 150 41 155 40C170 38 190 30 214 27"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** QR decorativo (ver `modulosDoQr`: não é lido por celular nenhum, de propósito). */
export function MockQr({ semente, className }: { semente: string; className?: string }) {
  const grade = modulosDoQr(semente);
  const lado = grade.length;
  let d = "";
  grade.forEach((linha, y) =>
    linha.forEach((cheio, x) => {
      if (cheio) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return (
    <svg viewBox={`-1 -1 ${lado + 2} ${lado + 2}`} className={cn("block", className)} shapeRendering="crispEdges">
      <rect x={-1} y={-1} width={lado + 2} height={lado + 2} fill="#ffffff" />
      <path d={d} fill="#0a0a0a" />
    </svg>
  );
}

export type EstadoDaEtapa = "feita" | "atual" | "proxima";

/** A trilha de etapas de uma obra, na ordem do template do nicho. */
export function MockEtapas({
  etapas,
  className,
}: {
  etapas: readonly { nome: string; estado: EstadoDaEtapa }[];
  className?: string;
}) {
  return (
    <ol className={cn("mk-gap-1 flex w-full", className)}>
      {etapas.map((etapa) => (
        <li key={etapa.nome} className="min-w-0 flex-1" data-mk="etapa" data-estado={etapa.estado}>
          <span
            className={cn(
              "mk-h-0.75 mk-rounded-1 block w-full origin-left",
              etapa.estado === "proxima" ? "bg-[var(--mk-sup-2)]" : "bg-[var(--mk-acento)]",
              etapa.estado === "atual" && "opacity-55",
            )}
          />
          <span
            className={cn(
              "mk-t-1 mk-mt-0.75 block truncate",
              etapa.estado === "proxima" ? "mk-tenue" : "font-semibold",
            )}
          >
            {etapa.nome}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Círculo com iniciais, o avatar das telas. */
export function MockAvatar({ nome, className }: { nome: string; className?: string }) {
  const iniciais = nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "mk-size-5 mk-t-1 inline-grid shrink-0 place-items-center rounded-full bg-[var(--mk-sup-2)] font-bold",
        className,
      )}
    >
      {iniciais}
    </span>
  );
}

/** Ícone de linha num quadrado, no traço dos ícones do ERP (lucide, 1.8). */
export function MockIcone({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("mk-size-4 inline-grid shrink-0 place-items-center [&>svg]:h-full [&>svg]:w-full", className)}>
      {children}
    </span>
  );
}
