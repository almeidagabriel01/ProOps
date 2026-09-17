/**
 * A geometria do seletor em roda, sem DOM.
 *
 * A roda é CIRCULAR, como a do relógio do iOS: depois da última frase vem a
 * primeira. Isso é o que permite ao revezamento automático andar sempre para a
 * frente, em vez de rebobinar quinze linhas de uma vez ao voltar ao começo.
 *
 * A posição é um número real, em "linhas": 3 é a quarta frase exatamente no
 * centro, 3,5 é o meio do caminho entre a quarta e a quinta. Ela cresce sem
 * limite enquanto a roda gira, e toda leitura passa pelo `modulo` daqui.
 */

/** Graus entre duas linhas vizinhas no cilindro. */
export const ANGULO_POR_LINHA = 20;

/**
 * Até quantas linhas do centro uma linha ainda é desenhada.
 *
 * A 4 linhas o ângulo é 80°, quase de perfil. A 5 seria 100°, já de costas
 * para quem olha, e o `backface-visibility` a apagaria de qualquer jeito.
 */
export const LINHAS_VISIVEIS = 4;

/** Resto sempre positivo: `-1 mod 16` é 15, não -1. */
export function modulo(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Quantas linhas separam a linha `indice` do centro, pelo lado mais curto.
 *
 * Positivo é abaixo do centro. O resultado cai em `[-total/2, total/2)`, que é
 * o que faz a última frase aparecer ACIMA da primeira quando a roda está no
 * começo.
 */
export function deslocamento(
  indice: number,
  posicao: number,
  total: number,
): number {
  return modulo(indice - posicao + total / 2, total) - total / 2;
}

/** A frase que está no centro para uma posição qualquer. */
export function indiceNaPosicao(posicao: number, total: number): number {
  return modulo(Math.round(posicao), total);
}

/**
 * A posição, mais perto da atual, em que `indice` fica no centro.
 *
 * Ir da frase 15 para a 0 é um passo para a frente, não quinze para trás.
 */
export function posicaoMaisProxima(
  atual: number,
  indice: number,
  total: number,
): number {
  return atual + deslocamento(indice, atual, total);
}

/**
 * Onde a roda para depois de um arrasto solto com velocidade.
 *
 * É a projeção do iOS: o movimento continua por uma fração de segundo depois
 * que o dedo sai, e a parada é arredondada para uma linha inteira. A projeção
 * é limitada para um arremesso forte não dar voltas inteiras e cair numa frase
 * que ninguém conseguiu ver passar.
 */
export function posicaoDeParada(
  posicao: number,
  velocidade: number,
  { projecao = 0.18, limite = 6 }: { projecao?: number; limite?: number } = {},
): number {
  const avanco = Math.max(-limite, Math.min(limite, velocidade * projecao));
  return Math.round(posicao + avanco);
}

export interface EstiloDaLinha {
  /** `transform` pronto para o cilindro. */
  transform: string;
  opacity: number;
  /** Fora do alcance: a linha não recebe clique. */
  visivel: boolean;
}

/**
 * Onde uma linha fica no cilindro.
 *
 * A linha é empurrada para a superfície (`translateZ(raio)`) DEPOIS de girar em
 * torno do eixo, então ela anda sobre o arco em vez de girar no lugar. O
 * `translateZ(-raio)` do começo traz o conjunto de volta, para que a linha do
 * centro fique exatamente no plano da tela e não pareça menor que o texto em
 * volta.
 */
export function estiloDaLinha(d: number, raio: number): EstiloDaLinha {
  const angulo = -d * ANGULO_POR_LINHA;
  const distancia = Math.abs(d);
  const visivel = distancia <= LINHAS_VISIVEIS + 0.5;
  const opacity = visivel
    ? Math.max(0, 1 - distancia / (LINHAS_VISIVEIS + 0.6))
    : 0;
  return {
    transform: `translateZ(${-raio}px) rotateX(${angulo.toFixed(3)}deg) translateZ(${raio}px)`,
    opacity: Number(opacity.toFixed(3)),
    visivel,
  };
}

/**
 * O raio que faz a distância entre duas linhas vizinhas, no cilindro, ser
 * exatamente a altura de uma linha.
 *
 * É a corda (`2R·sen(θ/2)`) que precisa valer a altura, e não o arco nem a
 * tangente: com ela, uma linha a meia altura do centro (a borda da lente) está
 * projetada exatamente onde a cópia nítida, que anda em linha reta, também
 * está. Com a tangente a diferença era de 1,5%, e a frase trocava de cor um
 * pixel antes de chegar na borda.
 */
export function raioParaAltura(alturaDaLinha: number): number {
  return alturaDaLinha / (2 * Math.sin((ANGULO_POR_LINHA * Math.PI) / 360));
}
