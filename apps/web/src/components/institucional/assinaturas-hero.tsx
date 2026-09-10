import React from "react";

import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * A assinatura do herói de cada sub-página.
 *
 * Os quatro heróis nasceram idênticos: mesma sobrancelha, mesmo título em
 * linhas, mesma marca gigante sangrando pela direita. Funcionava página a
 * página e falhava como conjunto, porque quem navega as quatro em sequência vê
 * o mesmo cartão quatro vezes com as palavras trocadas, e um site cujas páginas
 * são intercambiáveis parece um template por melhor que seja o texto.
 *
 * Então a marca sai do herói das sub-páginas (ela continua sendo a raiz) e cada
 * página ganha um desenho do PRÓPRIO assunto:
 *
 * | Página | Assinatura | O que ela diz |
 * |---|---|---|
 * | `/sobre` | os três retratos | são três, e você já vai vê-los |
 * | `/manifesto` | um selo com três marcas | são três critérios, e são fechados |
 * | `/produtos` | uma janela e um telefone | são dois, e um não é versão do outro |
 * | `/fale-conosco` | quatro linhas num ponto | quatro caminhos, todos em alguém |
 *
 * Duas regras valem para todas, e as duas vêm do orçamento desta superfície:
 *
 * - **A animação é CSS** (`.traco-desenha`, `.pulso-no`, `.hero-enter`), nunca
 *   `motion`. Isto vive acima da dobra, e um `initial={{opacity:0}}` segura o
 *   desenho até o bundle hidratar. As três classes declaram estado final no
 *   bloco de `prefers-reduced-motion`, então quem pede menos movimento vê o
 *   desenho pronto, e não um traço invisível.
 * - **Todo traço animado declara `pathLength={1}`**, senão o dasharray teria
 *   que ser o comprimento real do caminho, que muda a cada ponto que alguém
 *   mexer no desenho.
 */
interface AssinaturaProps {
  className?: string;
}

/** Traço padrão do conjunto, para as três assinaturas desenhadas. */
const TRACO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

function atraso(segundos: number) {
  return { "--traco-delay": `${segundos}s` } as React.CSSProperties;
}

/**
 * `/sobre`: os três retratos, encostados, sangrando pela direita.
 *
 * É a única assinatura com fotografia, e é o caso em que ela É o argumento: a
 * página existe para dizer quem está do outro lado do contrato, e três rostos
 * dizem isso antes da primeira linha de texto. Ficam dessaturados, a meia
 * opacidade e dissolvendo para baixo, para serem TEXTURA e não conteúdo: o
 * conteúdo (nome, papel, formação) vem logo abaixo, na faixa de pessoas, e
 * repeti-lo aqui seria a duplicação que esta passagem existe para matar.
 *
 * `priority` fica desligado nos três de propósito: são decoração acima da
 * dobra, e disputar largura de banda com o texto do LCP é o troco errado. A
 * caixa tem proporção fixa, então nada disso mexe no CLS.
 */
export function AssinaturaRetratos({
  className,
  fotos,
}: AssinaturaProps & { fotos: string[] }) {
  return (
    <div className={cn("flex items-start justify-end", className)}>
      {fotos.slice(0, 3).map((foto, i) => (
        <div
          key={foto}
          className="hero-enter relative aspect-[3/4] w-1/3 border-l border-white/10"
          style={
            {
              // Encostados, e o do meio descendo: três retratos alinhados pela
              // base são uma fileira de crachás, e três separados por espaço
              // são três caixas flutuando. Encostados eles leem como UM bloco.
              transform: i === 1 ? "translateY(14%)" : undefined,
              // A foto dissolve no fundo em vez de terminar numa borda. Sem
              // isto o herói ganha três retângulos, que é ornamento; com isto
              // ganha textura, que é o que a marca fazia antes.
              maskImage:
                "linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)",
              opacity: 0.45,
              "--hero-y": "26px",
              "--hero-delay": `${0.5 + i * 0.13}s`,
              "--hero-dur": "1s",
            } as React.CSSProperties
          }
        >
          <Image
            src={foto}
            alt=""
            aria-hidden="true"
            fill
            sizes="(min-width: 1024px) 12vw, 16vw"
            // `grayscale` vive AQUI e não no elemento de cima, e isso não é
            // arrumação: `.hero-enter` anima a propriedade `filter` (para o
            // blur de entrada) com `both`, então ela fica escrita no elemento
            // para sempre e apaga qualquer filtro que uma classe tenha posto
            // ali. O retrato saía colorido, sem nada falhar.
            className="object-cover object-top grayscale"
          />
        </div>
      ))}
    </div>
  );
}

/**
 * `/manifesto`: um selo que se desenha.
 *
 * Manifesto é documento assinado, não página de recursos, e selo é a forma que
 * um documento assinado tem. As três marcas no anel são os três princípios, e o
 * anel fechado é a afirmação de que são três, e não uma lista aberta que cresce
 * quando convém.
 */
export function AssinaturaSelo({ className }: AssinaturaProps) {
  const marcas = [0, 1, 2];
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={cn("block h-full w-full", className)}
      {...TRACO}
    >
      <circle
        cx="100"
        cy="100"
        r="92"
        pathLength={1}
        className="traco-desenha"
        style={{ ...atraso(0.35), "--traco-dur": "1.8s" } as React.CSSProperties}
        opacity="0.55"
      />
      <circle
        cx="100"
        cy="100"
        r="78"
        pathLength={1}
        className="traco-desenha"
        style={{ ...atraso(0.5), "--traco-dur": "1.6s" } as React.CSSProperties}
        opacity="0.3"
      />
      {marcas.map((i) => {
        // 12h, 4h e 8h. Três marcas equidistantes leem como divisão em três;
        // três marcas juntas leriam como um detalhe do anel.
        const angulo = (-90 + i * 120) * (Math.PI / 180);
        return (
          <g key={i}>
            <line
              x1={100 + Math.cos(angulo) * 70}
              y1={100 + Math.sin(angulo) * 70}
              x2={100 + Math.cos(angulo) * 86}
              y2={100 + Math.sin(angulo) * 86}
              pathLength={1}
              className="traco-desenha"
              style={atraso(1.1 + i * 0.14)}
            />
            <circle
              cx={100 + Math.cos(angulo) * 56}
              cy={100 + Math.sin(angulo) * 56}
              r="3"
              fill="currentColor"
              stroke="none"
              className="hero-enter"
              style={
                { "--hero-delay": `${1.3 + i * 0.14}s` } as React.CSSProperties
              }
            />
          </g>
        );
      })}
      <line
        x1="62"
        y1="100"
        x2="138"
        y2="100"
        pathLength={1}
        className="traco-desenha"
        style={atraso(1.6)}
        opacity="0.4"
      />
    </svg>
  );
}

/**
 * `/produtos`: uma janela e um telefone, em wireframe.
 *
 * A página inteira defende que são dois produtos e não duas versões do mesmo, e
 * a silhueta de uma janela ao lado da de um telefone diz isso sem uma palavra.
 * Wireframe e não captura: as capturas de verdade vêm mais abaixo, na cena
 * fixada, e gastá-las aqui tiraria a surpresa da única coisa nesta página que
 * é prova.
 */
export function AssinaturaAparelhos({ className }: AssinaturaProps) {
  return (
    <svg
      viewBox="0 0 220 180"
      aria-hidden="true"
      className={cn("block h-full w-full", className)}
      {...TRACO}
    >
      {/* A janela */}
      <rect
        x="4"
        y="16"
        width="152"
        height="108"
        pathLength={1}
        className="traco-desenha"
        style={{ ...atraso(0.4), "--traco-dur": "1.5s" } as React.CSSProperties}
      />
      <line
        x1="4"
        y1="34"
        x2="156"
        y2="34"
        pathLength={1}
        className="traco-desenha"
        style={atraso(0.9)}
        opacity="0.6"
      />
      {[14, 24, 34].map((cx, i) => (
        <circle
          key={cx}
          cx={cx}
          cy="25"
          r="2.4"
          fill="currentColor"
          stroke="none"
          className="hero-enter"
          style={{ "--hero-delay": `${1 + i * 0.06}s` } as React.CSSProperties}
          opacity="0.6"
        />
      ))}
      {[52, 68, 84, 100].map((y, i) => (
        <line
          key={y}
          x1="18"
          y1={y}
          x2={i % 2 === 0 ? 118 : 92}
          y2={y}
          pathLength={1}
          className="traco-desenha"
          style={atraso(1 + i * 0.1)}
          opacity="0.35"
        />
      ))}

      {/* O telefone, por cima e deslocado: sobrepor é o que impede que os dois
          leiam como duas opções de um seletor. */}
      <rect
        x="132"
        y="46"
        width="66"
        height="122"
        rx="9"
        pathLength={1}
        className="traco-desenha"
        style={{ ...atraso(0.75), "--traco-dur": "1.5s" } as React.CSSProperties}
      />
      <line
        x1="152"
        y1="56"
        x2="178"
        y2="56"
        pathLength={1}
        className="traco-desenha"
        style={atraso(1.35)}
        opacity="0.6"
      />
      {[78, 94, 110, 126].map((y, i) => (
        <line
          key={y}
          x1="144"
          y1={y}
          x2={i % 2 === 0 ? 186 : 170}
          y2={y}
          pathLength={1}
          className="traco-desenha"
          style={atraso(1.4 + i * 0.1)}
          opacity="0.35"
        />
      ))}
    </svg>
  );
}

/**
 * `/fale-conosco`: quatro linhas chegando num ponto só.
 *
 * A página é um roteador, não um formulário: quatro assuntos, quatro destinos,
 * e a promessa de que todos terminam em uma pessoa. O ponto é o único elemento
 * em movimento contínuo em qualquer um dos quatro heróis, e é ele que carrega
 * essa última parte.
 */
export function AssinaturaCanais({ className }: AssinaturaProps) {
  const entradas = [18, 74, 126, 182];
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={cn("block h-full w-full", className)}
      {...TRACO}
    >
      {entradas.map((y, i) => (
        <g key={y}>
          <path
            d={`M200 ${y} C 150 ${y}, 120 100, 62 100`}
            pathLength={1}
            className="traco-desenha"
            style={
              {
                ...atraso(0.45 + i * 0.16),
                "--traco-dur": "1.5s",
              } as React.CSSProperties
            }
            opacity="0.55"
          />
          <circle
            cx="196"
            cy={y}
            r="3"
            fill="currentColor"
            stroke="none"
            className="hero-enter"
            style={
              { "--hero-delay": `${0.4 + i * 0.16}s` } as React.CSSProperties
            }
            opacity="0.6"
          />
        </g>
      ))}
      <circle
        cx="50"
        cy="100"
        r="18"
        pathLength={1}
        className="traco-desenha"
        style={atraso(1.5)}
        opacity="0.45"
      />
      <circle
        cx="50"
        cy="100"
        r="6"
        fill="currentColor"
        stroke="none"
        className="pulso-no"
        style={{ "--pulso-delay": "1.8s" } as React.CSSProperties}
      />
    </svg>
  );
}
