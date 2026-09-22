import {
  COMODOS,
  ESPESSURA,
  MOVEIS,
  PAREDES,
  PROFUNDIDADE_DA_CASA,
  type ComodoId,
  type Janela,
  type Parede,
  type Retangulo,
} from "../../_content/cena-planta";

/**
 * O que a casa tem de volume, pronto para desenhar, NA ORDEM de desenho.
 *
 * Um SVG não tem teste de profundidade: o que vem depois no documento pinta por
 * cima. Então a ordem é o z-buffer, e errar a ordem é um sofá aparecendo na
 * frente da parede que deveria escondê-lo. É por isso que isto é um módulo puro
 * e testado, e não um `.sort()` escrito no componente.
 *
 * Tudo aqui é uma caixa alinhada aos eixos (paredes, móveis, pendentes), e para
 * caixas alinhadas vistas da diagonal (+x, +z) existe uma regra exata: A fica
 * atrás de B quando as duas se separam num eixo com A do lado menor
 * (`A.x1 <= B.x0` ou `A.z1 <= B.z0`). Quando nenhuma das duas condições vale, as
 * projeções não se sobrepõem, ou as caixas se tocam, e a ordem entre elas não
 * aparece na tela. Isso define um grafo acíclico, e a ordem é uma ordenação
 * topológica dele.
 *
 * O algoritmo "some x + z e ordene", que é o que se escreve primeiro, erra
 * justamente o caso desta casa: a divisória comprida que corta a planta de
 * ponta a ponta tem centro no meio dela, e metade da casa ficaria do lado
 * errado.
 */

export type Objeto =
  | {
      tipo: "parede";
      caixa: Retangulo;
      altura: number;
      parede: Parede;
      /** As janelas que ficam na face visível desta parede. */
      janelas: { comodo: ComodoId; janela: Janela }[];
    }
  | { tipo: "movel"; caixa: Retangulo; altura: number; comodo: ComodoId }
  | { tipo: "pendente"; caixa: Retangulo; comodo: ComodoId; luz: readonly [number, number] };

const T = ESPESSURA;

/**
 * A caixa de uma parede. As do fundo e as muretas crescem PARA FORA da casa,
 * para a face de dentro cair exatamente na divisa dos cômodos. As divisórias
 * são centradas na divisa e encurtadas meia espessura onde encontram outra
 * divisória: duas caixas que se atravessam não têm ordem de desenho correta.
 */
export function caixaDaParede(p: Parede): Retangulo {
  if (p.tipo === "fundo") {
    return p.eixo === "x"
      ? [p.de - T, p.fixo - T, p.ate, p.fixo]
      : [p.fixo - T, p.de, p.fixo, p.ate];
  }
  if (p.tipo === "mureta") {
    return p.eixo === "x"
      ? [p.de - T, p.fixo, p.ate + T, p.fixo + T]
      : [p.fixo, p.de, p.fixo + T, p.ate];
  }
  if (p.eixo === "x") return [p.de, p.fixo - T / 2, p.ate, p.fixo + T / 2];
  return [
    p.fixo - T / 2,
    p.de > 0 ? p.de + T / 2 : p.de,
    p.fixo + T / 2,
    p.ate < PROFUNDIDADE_DA_CASA ? p.ate - T / 2 : p.ate,
  ];
}

const EPS = 1e-9;

/** A fica atrás de B, para quem olha da diagonal (+x, +z). */
export function atras(a: Retangulo, b: Retangulo): boolean {
  return a[2] <= b[0] + EPS || a[3] <= b[1] + EPS;
}

function janelasDaParede(p: Parede): { comodo: ComodoId; janela: Janela }[] {
  if (p.tipo !== "fundo") return [];
  const parede = p.eixo === "x" ? "fundo" : "lateral";
  return COMODOS.flatMap((c) =>
    c.janela && c.janela.parede === parede ? [{ comodo: c.id, janela: c.janela }] : [],
  );
}

function montaObjetos(): Objeto[] {
  const objetos: Objeto[] = [];
  for (const parede of PAREDES) {
    objetos.push({
      tipo: "parede",
      caixa: caixaDaParede(parede),
      altura: parede.altura,
      parede,
      janelas: janelasDaParede(parede),
    });
  }
  for (const movel of MOVEIS) {
    objetos.push({ tipo: "movel", caixa: movel.retangulo, altura: movel.altura, comodo: movel.comodo });
  }
  for (const comodo of COMODOS) {
    const [x, z] = comodo.luz;
    objetos.push({
      tipo: "pendente",
      caixa: [x - 0.15, z - 0.15, x + 0.15, z + 0.15],
      comodo: comodo.id,
      luz: comodo.luz,
    });
  }
  return objetos;
}

/**
 * Ordenação topológica pela relação `atras`. Entre objetos sem relação, o
 * desempate é o canto de trás (`x0 + z0`), que só serve para a ordem ser
 * estável: se os dois não têm relação, a tela não mostra a diferença.
 */
export function ordenaParaDesenho(objetos: Objeto[]): Objeto[] {
  const n = objetos.length;
  const faltam = new Array<number>(n).fill(0);
  const frente: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (atras(objetos[i].caixa, objetos[j].caixa) && !atras(objetos[j].caixa, objetos[i].caixa)) {
        frente[i].push(j);
        faltam[j]++;
      }
    }
  const chave = (i: number) => objetos[i].caixa[0] + objetos[i].caixa[1];
  const prontos = objetos.map((_, i) => i).filter((i) => faltam[i] === 0);
  const ordem: Objeto[] = [];
  while (prontos.length > 0) {
    prontos.sort((a, b) => chave(a) - chave(b) || a - b);
    const i = prontos.shift()!;
    ordem.push(objetos[i]);
    for (const j of frente[i]) if (--faltam[j] === 0) prontos.push(j);
  }
  if (ordem.length !== n) throw new Error("A casa tem um ciclo de profundidade");
  return ordem;
}

export const OBJETOS: readonly Objeto[] = ordenaParaDesenho(montaObjetos());
