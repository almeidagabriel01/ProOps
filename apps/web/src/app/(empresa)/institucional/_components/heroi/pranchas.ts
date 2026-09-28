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

  // Planta baixa com as câmeras nos cantos, o campo de visão de cada uma, a
  // central de alarme e dois sensores.
  seguranca: {
    tracos: [
      "M3 6H97V66H3Z",
      "M52 6V30",
      "M52 44V66",
      "M3 38H28",
      "M40 38H52",
      "M7 10H15V15H7Z",
      "M85 57H93V62H85Z",
      "M64 12H80V24H64Z",
      "M67 16H77M67 20H77",
    ],
    guias: ["M15 13L42 20M15 13L30 34", "M85 59L60 52M85 59L72 42"],
    discos: [
      [42, 52, 2.6],
      [88, 30, 2.6],
    ],
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

  // Vista de frente de uma janela de correr: duas folhas que se sobrepõem no
  // meio, os puxadores, os reflexos no vidro e a seta de quem desliza.
  vidracaria: {
    tracos: [
      "M6 6H94V60H6Z",
      "M10 10H52V56H10Z",
      "M48 10H90V56H48Z",
      "M4 64H96",
      "M44 30V36M56 30V36",
      "M18 44L30 24M24 48L36 28",
      "M62 44L74 24M68 48L80 28",
    ],
    guias: ["M60 69H80M76 67L80 69L76 71"],
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
