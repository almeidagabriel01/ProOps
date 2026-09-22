import type { SegmentoId } from "../../_content/institucional-copy";

/**
 * Os desenhos da prancheta do herói: um ofício por prancha.
 *
 * Isto é DESENHO, não texto: o nome de cada ofício mora em `SEGMENTOS`
 * (`_content/institucional-copy.ts`), e o `Record<SegmentoId, Prancha>` abaixo
 * obriga os dois a andarem juntos. Um segmento sem prancha não compila, em vez
 * de virar um buraco que só aparece na tela.
 *
 * Cada prancha é desenhada numa caixa de 100 por 72, como uma folha de
 * caderno: o componente decide o tamanho na tela, e o traço é `non-scaling`,
 * então a linha sai com a mesma espessura numa prancha grande e numa pequena.
 * Aqui não há `pathLength` nem traço que se desenha, e é por isso que
 * `vector-effect` é seguro nestes caminhos (na casa da landing não seria: lá o
 * tracejado é a animação).
 *
 * As plantas são esquemáticas de propósito. O que a cena precisa dizer é "cada
 * ofício desenha o projeto dele antes de vender", e não qual é a metragem da
 * piscina; detalhe demais numa prancha de 200px vira borrão.
 */

export interface Prancha {
  /** O que é peça: traço contínuo. */
  tracos: readonly string[];
  /** O que é referência: eixo, fluxo de ar, caminho. Sai tracejado. */
  guias?: readonly string[];
  /** Luminária, árvore, ponto de medida: `[cx, cy, r]`. */
  discos?: ReadonlyArray<readonly [number, number, number]>;
  /** Onde a prancha cai na prancheta: centro em % do palco, e a largura. */
  lugar: { readonly x: number; readonly y: number; readonly largura: number; readonly giro: number };
  /**
   * O lugar dela num celular. **Sem isto a prancha não existe abaixo de `md`**,
   * e é o normal: numa tela de 393px cabem três desenhos legíveis, não sete.
   *
   * As três que ficam moram na FAIXA DE CIMA, que é onde a luz passeia no
   * celular (`lanterna-passeia-alto`). O texto ancora embaixo e ali a luz nunca
   * chega, então nenhum desenho aceso cruza o parágrafo.
   */
  celular?: { readonly x: number; readonly y: number; readonly largura: number };
}

export const PRANCHAS: Record<SegmentoId, Prancha> = {
  automacao: {
    tracos: [
      "M3 6H97V66H3Z",
      "M56 6V32",
      "M56 48V66",
      "M3 40H30",
      "M42 40H56",
      "M66 12H92V26H66Z",
      "M10 48H34V62H10Z",
      "M10 54H34",
      "M23 22H33M28 17V27",
      "M71 50H81M76 45V55",
    ],
    guias: ["M56 48A16 16 0 0 0 40 32", "M30 40H42"],
    discos: [
      [28, 22, 3.4],
      [76, 50, 3.4],
    ],
    lugar: { x: 32, y: 20, largura: 26, giro: -2 },
    celular: { x: 31, y: 21, largura: 52 },
  },

  cortinas: {
    tracos: [
      "M14 14H86V60H14Z",
      "M50 14V60",
      "M8 62H92",
      "M6 8H94",
      "M20 8V3M80 8V3",
      "M12 8V56M17 8V56M22 8V56M27 8V56M32 8V56",
      "M10 56Q21 61 34 56",
      "M68 8V56M73 8V56M78 8V56M83 8V56M88 8V56",
      "M66 56Q79 61 90 56",
    ],
    guias: ["M50 66V70M14 68H86"],
    lugar: { x: 63, y: 19, largura: 18, giro: 3 },
  },

  marcenaria: {
    tracos: [
      "M6 4H94V62H6Z",
      "M6 24H94",
      "M6 44H94",
      "M52 4V62",
      "M46 30V38M58 30V38",
      "M46 50V58M58 50V58",
      "M14 62V68M86 62V68",
      "M4 68H96",
      "M14 12H44V20H14Z",
    ],
    guias: ["M2 4V62", "M0 33H4M0 33H4"],
    lugar: { x: 80, y: 55, largura: 20, giro: 2 },
  },

  paisagismo: {
    tracos: [
      "M3 6H97V66H3Z",
      "M66 8H95V22H66Z",
      "M8 30l4-5M14 32l4-5M20 30l4-5",
      "M60 60l4-5M66 62l4-5M72 60l4-5",
    ],
    guias: [
      "M3 52C22 52 26 26 48 26S78 44 97 18",
      "M3 62C24 62 32 36 52 36S82 54 97 28",
    ],
    discos: [
      [24, 20, 8],
      [38, 14, 4.5],
      [79, 47, 9],
      [90, 34, 5],
    ],
    lugar: { x: 8, y: 18, largura: 17, giro: 4 },
  },

  piscinas: {
    tracos: [
      "M3 6H97V66H3Z",
      "M22 14H74A7 7 0 0 1 81 21V47A7 7 0 0 1 74 54H22A7 7 0 0 1 15 47V21A7 7 0 0 1 22 14Z",
      "M25 19H71A4 4 0 0 1 75 23V45A4 4 0 0 1 71 49H25A4 4 0 0 1 21 45V23A4 4 0 0 1 25 19Z",
      "M58 14V8M68 14V8M58 11H68",
      "M3 60H97",
      "M14 60V66M26 60V66M38 60V66M50 60V66M62 60V66M74 60V66M86 60V66",
    ],
    guias: ["M30 34q6-4 12 0t12 0t12 0", "M30 40q6-4 12 0t12 0t12 0"],
    lugar: { x: 58, y: 60, largura: 22, giro: -2 },
  },

  solar: {
    tracos: [
      "M6 56L50 16L94 56",
      "M6 56H94",
      "M10 56V68H90V56",
      "M22 50L42 32L54 38L34 56Z",
      "M28 44.5L40 50.5M35 38.5L47 44.5",
      "M58 32L78 50L66 56L48 38Z",
      "M64 38L52 44M70 44L58 50",
    ],
    guias: ["M50 16V6", "M40 10L50 6L60 10"],
    lugar: { x: 93, y: 74, largura: 17, giro: -4 },
  },

  climatizacao: {
    tracos: [
      "M6 6H94V64H6Z",
      "M6 58H94",
      "M62 14H90V25H62Z",
      "M66 25L64 29M72 25L70 29M78 25L76 29M84 25L82 29",
      "M6 10H40V19H6",
      "M30 19L26 23M36 19L32 23",
      "M14 44H34V58H14Z",
      "M14 50H34",
    ],
    guias: ["M60 29C44 35 30 33 16 39", "M60 35C46 43 30 43 16 49"],
    lugar: { x: 87, y: 27, largura: 16, giro: -3 },
  },
};

/**
 * A última prancha: a folha em branco com as marcas de registro, e o nome de
 * quem chegou agora. Ela não é um `SegmentoId` porque não é um ofício: é o
 * convite, e é o único desenho com moldura tracejada.
 */
export const PRANCHA_EM_BRANCO: Prancha = {
  tracos: [
    "M4 18V6H18",
    "M82 6H96V18",
    "M4 54V66H18",
    "M82 66H96V54",
    "M42 36H58M50 28V44",
  ],
  guias: ["M4 6H96V66H4Z"],
  lugar: { x: 72, y: 82, largura: 21, giro: 1 },
  celular: { x: 79, y: 19, largura: 35 },
};
