import type { Comodo, ComodoId } from "./dados";

/**
 * A projeção isométrica da cena, pura e compartilhada.
 *
 * O SVG, o three.js, o diretor e os testes projetam pelo MESMO par de fórmulas,
 * e é isso que deixa o canvas 3D pousar pixel a pixel em cima do desenho:
 *
 *   u = (x − z) · cos 30°
 *   v = (x + z) · sen 30° − y
 *
 * Isso é a isometria verdadeira (câmera em (1, 1, 1) olhando para a origem)
 * escalada por √1,5, o que dá `y` com peso 1 e mantém as alturas legíveis em
 * metros. `v` cresce para BAIXO, como no SVG.
 *
 * A câmera da cena só faz zoom e pan, de propósito: numa projeção ortográfica
 * os dois são afins em 2D, então um `transform` no SVG e um
 * `OrthographicCamera` no three dão exatamente o mesmo quadro. Girar a câmera
 * exigiria reprojetar o desenho inteiro a cada quadro, e o SVG existe
 * justamente para não ter JavaScript por quadro no celular.
 */

export const COS30 = Math.sqrt(3) / 2;
export const SEN30 = 0.5;
/** Fator entre a unidade isométrica daqui e a unidade de mundo do three. */
export const ESCALA_ISO = Math.sqrt(1.5);

/** `[x, y, z]`: `y` é a altura. */
export type Ponto3 = readonly [number, number, number];
export type Ponto2 = readonly [number, number];

export function projeta([x, y, z]: Ponto3): [number, number] {
  return [(x - z) * COS30, (x + z) * SEN30 - y];
}

/** O inverso de `projeta`, para um ponto no PISO (`y = 0`). Forma fechada. */
export function desprojetaNoPiso([u, v]: Ponto2): [number, number] {
  const diferenca = u / COS30; // x − z
  const soma = v / SEN30; // x + z
  return [(soma + diferenca) / 2, (soma - diferenca) / 2];
}

/** Em que cômodo cai um ponto do piso. `null` fora da casa. */
export function comodoEm(
  [x, z]: Ponto2,
  comodos: readonly Comodo[],
): ComodoId | null {
  for (const comodo of comodos) {
    const [x0, z0, x1, z1] = comodo.retangulo;
    if (x >= x0 && x < x1 && z >= z0 && z < z1) return comodo.id;
  }
  return null;
}

/** O quadro do SVG, em unidades isométricas: o `viewBox`. */
export interface Caixa {
  u: number;
  v: number;
  largura: number;
  altura: number;
}

/** A câmera da cena. `alvo` é um ponto do piso, `[x, z]`. */
export interface Camera {
  zoom: number;
  alvo: Ponto2;
}

/**
 * O menor retângulo que contém a casa inteira (piso até o pé direito), com
 * folga. Os cantos da caixa da casa bastam: o isométrico de um paralelepípedo é
 * o hexágono dos seus oito cantos.
 */
export function caixaDaCasa(
  largura: number,
  profundidade: number,
  alturaMaxima: number,
  folga: number,
): Caixa {
  const cantos: Ponto3[] = [];
  for (const x of [0, largura])
    for (const z of [0, profundidade])
      for (const y of [0, alturaMaxima]) cantos.push([x, y, z]);
  const projetados = cantos.map(projeta);
  const us = projetados.map((p) => p[0]);
  const vs = projetados.map((p) => p[1]);
  const u0 = Math.min(...us) - folga;
  const v0 = Math.min(...vs) - folga;
  return {
    u: u0,
    v: v0,
    largura: Math.max(...us) + folga - u0,
    altura: Math.max(...vs) + folga - v0,
  };
}

/**
 * O ponto do piso que cai no centro do quadro: o alvo da câmera de repouso.
 *
 * Não é o centro da planta. A caixa inclui as paredes de pé, que sobem na tela,
 * e o centro da planta ficaria abaixo do meio: com ele no centro, o topo das
 * paredes do fundo sairia do quadro.
 */
export function alvoDoQuadro(caixa: Caixa): [number, number] {
  return desprojetaNoPiso([
    caixa.u + caixa.largura / 2,
    caixa.v + caixa.altura / 2,
  ]);
}

/**
 * A câmera como uma afim do plano isométrico: `tela = escala · p + t`, em
 * unidades do `viewBox`. O alvo cai no CENTRO do quadro.
 *
 * É o que o SVG põe no `transform` do grupo da casa, e o que o three reproduz
 * centrando a câmera ortográfica no mesmo alvo.
 */
export function transformaCamera(
  camera: Camera,
  caixa: Caixa,
): { tx: number; ty: number; escala: number } {
  const [au, av] = projeta([camera.alvo[0], 0, camera.alvo[1]]);
  const cx = caixa.u + caixa.largura / 2;
  const cy = caixa.v + caixa.altura / 2;
  return {
    tx: cx - camera.zoom * au,
    ty: cy - camera.zoom * av,
    escala: camera.zoom,
  };
}

/** Onde um ponto do mundo aparece, como FRAÇÃO do quadro (0 a 1 nos dois eixos). */
export function naCaixa(
  ponto: Ponto3,
  camera: Camera,
  caixa: Caixa,
): [number, number] {
  const [u, v] = projeta(ponto);
  const { tx, ty, escala } = transformaCamera(camera, caixa);
  return [
    (escala * u + tx - caixa.u) / caixa.largura,
    (escala * v + ty - caixa.v) / caixa.altura,
  ];
}

/** O inverso de `naCaixa` para o piso: de uma fração do quadro ao ponto `[x, z]`. */
export function daCaixaAoPiso(
  [fx, fy]: Ponto2,
  camera: Camera,
  caixa: Caixa,
): [number, number] {
  const { tx, ty, escala } = transformaCamera(camera, caixa);
  const u = (caixa.u + fx * caixa.largura - tx) / escala;
  const v = (caixa.v + fy * caixa.altura - ty) / escala;
  return desprojetaNoPiso([u, v]);
}

/**
 * O frustum do `OrthographicCamera` que reproduz o quadro do SVG, em unidades
 * de mundo do three, com a câmera centrada no alvo.
 */
export function frustoOrtografico(
  camera: Camera,
  caixa: Caixa,
): { left: number; right: number; top: number; bottom: number } {
  const meiaLargura = caixa.largura / camera.zoom / 2 / ESCALA_ISO;
  const meiaAltura = caixa.altura / camera.zoom / 2 / ESCALA_ISO;
  return {
    left: -meiaLargura,
    right: meiaLargura,
    top: meiaAltura,
    bottom: -meiaAltura,
  };
}

/**
 * Matrizes `matrix(a b c d e f)` do SVG que levam um plano LOCAL da casa para a
 * tela. Cada face é desenhada como um retângulo comum no próprio plano, e a
 * matriz faz a isometria.
 *
 * Isso não é só conveniência. A cortina desce com `scaleY` a partir do topo da
 * janela, e na tela o topo de uma janela isométrica é uma linha INCLINADA: um
 * `scaleY` em coordenadas de tela entortaria a cortina. Dentro do plano da
 * parede o topo é horizontal, e o `transform` CSS de um filho é aplicado no
 * sistema de coordenadas local, ou seja, antes da matriz do pai. A cortina
 * desce reta.
 */
export type Matriz = readonly [number, number, number, number, number, number];

/** Piso (ou tampo) na altura `y`: local `(x, z)`. */
export function matrizDoPiso(y = 0): Matriz {
  return [COS30, SEN30, -COS30, SEN30, 0, -y];
}

/**
 * Face de uma parede: local `(a, h)`, com `a` sendo a coordenada ABSOLUTA ao
 * longo da parede (o `x` dela, ou o `z`) e `h` a altura, para CIMA (daí o
 * `-1`). Com `a` absoluto, um trecho de `de` a `ate` é só um `<rect>` de
 * `x = de` e largura `ate − de`.
 */
export function matrizDaParede(eixo: "x" | "z", fixo: number): Matriz {
  if (eixo === "x") {
    const [e, f] = projeta([0, 0, fixo]);
    return [COS30, SEN30, 0, -1, e, f];
  }
  const [e, f] = projeta([fixo, 0, 0]);
  return [-COS30, SEN30, 0, -1, e, f];
}

export function matrizCss(m: Matriz): string {
  return `matrix(${m.map((n) => arredonda(n)).join(" ")})`;
}

/** Quatro casas bastam para o olho e mantêm o HTML curto e estável. */
export function arredonda(n: number, casas = 4): number {
  const fator = 10 ** casas;
  const r = Math.round(n * fator) / fator;
  return Object.is(r, -0) ? 0 : r;
}
