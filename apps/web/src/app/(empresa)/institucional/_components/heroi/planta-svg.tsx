import React from "react";

import {
  COMODOS,
  ITENS,
  PE_DIREITO,
  type ComodoId,
  type Janela,
  type Retangulo,
} from "../../_content/cena-planta";
import { OBJETOS, type Objeto } from "./desenho";
import { matrizCss, matrizDaParede, matrizDoPiso, arredonda as r } from "./projecao";
import { CAIXA } from "./roteiro";

/**
 * A casa, em SVG isométrico. É o renderizador que TODO MUNDO vê primeiro: o
 * celular, a corrida do Lighthouse, quem pede menos movimento, e o desktop até
 * o three.js assumir por cima.
 *
 * Componente de SERVIDOR, e o cliente nunca o hidrata (`SemHidratar`, em
 * `heroi-raiz.tsx`). Nada aqui tem estado: tudo o que muda (luzes, cortinas,
 * câmera) é uma variável CSS lida pelo estilo, escrita pelo `<style>` do
 * servidor no primeiro paint e pelo diretor depois.
 *
 * Cada face é um retângulo comum desenhado no próprio plano, dentro de um
 * `<g>` com a matriz isométrica daquele plano (`projecao.ts`). É o que deixa a
 * cortina descer reta: o `scaleY` dela é aplicado no plano da parede, onde o
 * topo da janela é horizontal.
 *
 * O traço se desenha no primeiro paint (`.traco-desenha`, com `pathLength="1"`
 * em todo caminho), em ordem de profundidade: a casa se constrói do fundo para
 * a frente, como alguém desenhando a planta.
 */

const ID_LUZ = "heroi-planta-luz";

/** Só ganha cortina a janela de um cômodo que tem cortina especificada. */
const COM_CORTINA = new Set(ITENS.filter((i) => i.cortina).map((i) => i.comodo));
const ID_PREGAS = "heroi-planta-pregas";

/** Retângulo como caminho, para o `pathLength` valer em todos os navegadores. */
function retangulo(x: number, y: number, w: number, h: number): string {
  return `M${r(x)} ${r(y)}H${r(x + w)}V${r(y + h)}H${r(x)}Z`;
}

/** Atraso do traço, pela ordem de desenho, somado à espera da abertura. */
function atraso(ordem: number): React.CSSProperties {
  return {
    "--traco-delay": `calc(var(--espera, 0s) + ${r(0.15 + ordem * 0.028, 3)}s)`,
    "--traco-dur": "1.1s",
  } as React.CSSProperties;
}

/**
 * Uma caixa: face da frente (`z = z1`), face da direita (`x = x1`) e tampo,
 * nessa ordem. São as três que a diagonal (+x, +z) enxerga.
 */
function Caixa({
  caixa: [x0, z0, x1, z1],
  altura,
  ordem,
  tom,
}: {
  caixa: Retangulo;
  altura: number;
  ordem: number;
  tom: "parede" | "movel" | "mureta";
}) {
  const estilo = atraso(ordem);
  return (
    <g className={`planta-caixa planta-caixa--${tom}`}>
      {altura > 0.05 && (
        <>
          <g transform={matrizCss(matrizDaParede("x", z1))}>
            <path className="planta-face planta-face--frente" d={retangulo(x0, 0, x1 - x0, altura)} />
            <path className="planta-aresta traco-desenha" pathLength={1} style={estilo} d={retangulo(x0, 0, x1 - x0, altura)} />
          </g>
          <g transform={matrizCss(matrizDaParede("z", x1))}>
            <path className="planta-face planta-face--lado" d={retangulo(z0, 0, z1 - z0, altura)} />
            <path className="planta-aresta traco-desenha" pathLength={1} style={estilo} d={retangulo(z0, 0, z1 - z0, altura)} />
          </g>
        </>
      )}
      <g transform={matrizCss(matrizDoPiso(altura))}>
        <path className="planta-face planta-face--tampo" d={retangulo(x0, z0, x1 - x0, z1 - z0)} />
        <path className="planta-aresta traco-desenha" pathLength={1} style={estilo} d={retangulo(x0, z0, x1 - x0, z1 - z0)} />
      </g>
    </g>
  );
}

/**
 * Uma janela na face de dentro de uma parede do fundo: o vidro, o caixilho e,
 * quando o cômodo tem cortina especificada, a cortina, que desce com
 * `--cortina-<cômodo>` a partir da verga.
 */
function JanelaNaParede({
  comodo,
  janela,
  eixo,
  fixo,
  ordem,
}: {
  comodo: ComodoId;
  janela: Janela;
  eixo: "x" | "z";
  fixo: number;
  ordem: number;
}) {
  const largura = janela.ate - janela.de;
  const altura = janela.verga - janela.peitoril;
  const temCortina = COM_CORTINA.has(comodo);
  return (
    <g transform={matrizCss(matrizDaParede(eixo, fixo))}>
      <path className="planta-vidro" d={retangulo(janela.de, janela.peitoril, largura, altura)} />
      <path
        className="planta-luar"
        d={`M${r(janela.de + largura * 0.15)} ${r(janela.verga - 0.1)}L${r(janela.de + largura * 0.45)} ${r(janela.peitoril + 0.1)}`}
      />
      {temCortina && (
        <g
          className="planta-cortina"
          style={{ "--cortina": `var(--cortina-${comodo})`, "--luz": `var(--luz-${comodo})` } as React.CSSProperties}
        >
          <rect className="planta-cortina__tecido" x={r(janela.de - 0.06)} y={r(janela.peitoril - 0.04)} width={r(largura + 0.12)} height={r(altura + 0.02)} fill={`url(#${ID_PREGAS})`} />
          <rect className="planta-cortina__calor" x={r(janela.de - 0.06)} y={r(janela.peitoril - 0.04)} width={r(largura + 0.12)} height={r(altura + 0.02)} />
        </g>
      )}
      <path className="planta-aresta traco-desenha" pathLength={1} style={atraso(ordem)} d={retangulo(janela.de, janela.peitoril, largura, altura)} />
      <path className="planta-trilho" d={`M${r(janela.de - 0.12)} ${r(janela.verga + 0.06)}H${r(janela.ate + 0.12)}`} />
    </g>
  );
}

/** O pendente: o fio, a cúpula e a lâmpada, que acende com a luz do cômodo. */
function Pendente({ comodo, luz: [x, z], ordem }: { comodo: ComodoId; luz: readonly [number, number]; ordem: number }) {
  const topo = PE_DIREITO - 0.25;
  const cupula = 1.95;
  return (
    <g
      className="planta-pendente"
      style={{ "--luz": `var(--luz-${comodo})` } as React.CSSProperties}
    >
      <g transform={matrizCss(matrizDaParede("x", z))}>
        <path className="planta-fio" d={`M${r(x)} ${r(topo)}V${r(cupula + 0.12)}`} />
        <path className="planta-aresta traco-desenha" pathLength={1} style={atraso(ordem)} d={`M${r(x - 0.2)} ${r(cupula)}L${r(x)} ${r(cupula + 0.14)}L${r(x + 0.2)} ${r(cupula)}Z`} />
        <circle className="planta-halo" cx={r(x)} cy={r(cupula - 0.02)} r={0.55} fill={`url(#${ID_LUZ})`} />
        <circle className="planta-lampada" cx={r(x)} cy={r(cupula - 0.02)} r={0.07} />
      </g>
    </g>
  );
}

function desenha(objeto: Objeto, ordem: number) {
  if (objeto.tipo === "movel") {
    return <Caixa key={ordem} caixa={objeto.caixa} altura={objeto.altura} ordem={ordem} tom="movel" />;
  }
  if (objeto.tipo === "pendente") {
    return <Pendente key={ordem} comodo={objeto.comodo} luz={objeto.luz} ordem={ordem} />;
  }
  const { parede } = objeto;
  const tom = parede.tipo === "mureta" ? "mureta" : "parede";
  // A face que se vê de uma parede do fundo é a de DENTRO: `z = 0` para a do
  // fundo e `x = 0` para a lateral, que são as bordas da caixa voltadas para a
  // casa. As janelas vão nela.
  return (
    <g key={ordem}>
      <Caixa caixa={objeto.caixa} altura={objeto.altura} ordem={ordem} tom={tom} />
      {objeto.janelas.map(({ comodo, janela }) => (
        <JanelaNaParede
          key={comodo}
          comodo={comodo}
          janela={janela}
          eixo={parede.eixo}
          fixo={parede.fixo}
          ordem={ordem}
        />
      ))}
    </g>
  );
}

/** As tábuas do deck da varanda: é a textura que diz "lado de fora". */
function Deck({ retangulo: [x0, z0, x1, z1] }: { retangulo: Retangulo }) {
  const linhas: string[] = [];
  for (let z = z0 + 0.35; z < z1 - 0.01; z += 0.35) linhas.push(`M${r(x0)} ${r(z)}H${r(x1)}`);
  return <path className="planta-deck" d={linhas.join("")} />;
}

export function PlantaSvg({ className }: { className?: string }) {
  const viewBox = [CAIXA.u, CAIXA.v, CAIXA.largura, CAIXA.altura].map((n) => r(n)).join(" ");

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={viewBox}
      className={className}
      data-planta=""
    >
      <defs>
        <radialGradient id={ID_LUZ}>
          <stop offset="0" stopColor="rgb(255 196 138)" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="rgb(255 176 102)" stopOpacity="0.38" />
          <stop offset="1" stopColor="rgb(255 176 102)" stopOpacity="0" />
        </radialGradient>
        <pattern id={ID_PREGAS} width="0.22" height="1" patternUnits="userSpaceOnUse">
          <rect width="0.22" height="1" fill="rgb(203 213 225)" fillOpacity="0.2" />
          <rect x="0.14" width="0.08" height="1" fill="rgb(15 23 42)" fillOpacity="0.35" />
        </pattern>
      </defs>

      {/* A câmera. Zoom e pan em unidades do viewBox, pelas três variáveis que
          o roteiro escreve. `view-box` como caixa de referência para o
          translate valer em unidades do desenho, e não do elemento. */}
      <g className="planta-camera">
        <g transform={matrizCss(matrizDoPiso(0))}>
          {COMODOS.map((comodo, i) => {
            const [x0, z0, x1, z1] = comodo.retangulo;
            return (
              <g key={comodo.id} data-comodo={comodo.id}>
                <path className="planta-piso" d={retangulo(x0, z0, x1 - x0, z1 - z0)} />
                {comodo.id === "varanda" && <Deck retangulo={comodo.retangulo} />}
                <path className="planta-aresta planta-aresta--piso traco-desenha" pathLength={1} style={atraso(i)} d={retangulo(x0, z0, x1 - x0, z1 - z0)} />
              </g>
            );
          })}
          {/* A luz que cai no piso, somada por `screen`. É a primeira coisa que
              diz "aceso", e por isso vem antes de qualquer volume: parede e
              móvel pintam por cima dela, como a sombra de verdade faria. */}
          <g className="planta-brilhos">
            {COMODOS.map((comodo) => (
              <ellipse
                key={comodo.id}
                className="planta-brilho"
                style={{ "--luz": `var(--luz-${comodo.id})` } as React.CSSProperties}
                cx={comodo.luz[0]}
                cy={comodo.luz[1]}
                rx={comodo.id === "varanda" ? 3.4 : 2.6}
                ry={comodo.id === "varanda" ? 2.2 : 2.3}
                fill={`url(#${ID_LUZ})`}
              />
            ))}
          </g>
        </g>
        {OBJETOS.map((objeto, i) => desenha(objeto, i + COMODOS.length))}
      </g>
    </svg>
  );
}
