/**
 * A rolagem de uma cena grudada, dividida em fatias iguais: uma por frase da
 * roda, uma por operação da mesa.
 *
 * Tudo aqui é puro e recebe o progresso da cena inteira (0..1). Dentro de cada
 * fatia a animação ocupa só a primeira parte (`ANIMA_ATE`); o resto é pausa de
 * leitura, com a cena parada no estado completo. Sem essa pausa a frase
 * seguinte começaria a ser digitada no instante em que a ficha da anterior
 * termina de se montar, e ninguém chegaria a lê-la.
 */

/** Fração de cada fatia em que a animação acontece. */
export const ANIMA_ATE = 0.8;

/**
 * Onde, dentro da fatia, um clique leva a página: logo depois de a animação
 * terminar, com a cena inteira na tela e ainda longe da troca.
 */
export const PARADA_NA_FATIA = 0.82;

const limitar = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/** A fatia em que o progresso está. O fim exato (1) pertence à última. */
export function indiceDaFatia(progresso: number, total: number): number {
  return limitar(Math.floor(progresso * total), 0, total - 1);
}

/** 0..1 da fatia, sem a pausa: 1 assim que a animação dela termina. */
export function progressoNaFatia(
  progresso: number,
  indice: number,
  total: number,
  animaAte = ANIMA_ATE,
): number {
  return limitar((progresso * total - indice) / animaAte, 0, 1);
}

/**
 * A animação de uma fatia, considerando a ENTRADA do palco.
 *
 * A primeira fatia não espera o palco grudar: ela se monta durante a
 * aproximação (`entrada`, 0..1, que vai de o trilho aparecer na tela até ele
 * chegar ao topo). Sem isso o palco chegava vazio, e a primeira coisa que a
 * pessoa via da seção era um cartão em branco. Dentro do trilho, a primeira
 * fatia é só pausa de leitura.
 */
export function progressoComEntrada(
  progresso: number,
  entrada: number,
  indice: number,
  total: number,
): number {
  if (indice === 0) return limitar(entrada, 0, 1);
  return progressoNaFatia(progresso, indice, total);
}

/** O progresso da cena inteira que deixa a fatia `indice` pronta na tela. */
export function progressoDaParada(
  indice: number,
  total: number,
  local = PARADA_NA_FATIA,
): number {
  return limitar((indice + local) / total, 0, 1);
}

/** Fração da fatia, em cada ponta, em que a roda gira. No meio ela fica parada. */
export const GIRO = 0.15;

const suave = (t: number) => t * t * (3 - 2 * t);

/**
 * A posição da roda para um progresso, em linhas.
 *
 * A roda fica parada e centrada no meio de cada fatia, enquanto a frase é
 * escrita e lida, e só gira nas pontas: meia linha no fim de uma fatia, meia
 * no começo da seguinte. A fronteira entre as fatias cai exatamente em meia
 * linha, que é quando a frase seguinte cruza a borda da lente, então o que
 * acende na roda e o que começa a ser digitado ao lado são sempre a mesma
 * frase. Com um mapeamento linear a roda nunca parava: durante a leitura a
 * frase ficava um terço de linha fora da lente.
 */
export function posicaoDaRoda(progresso: number, total: number): number {
  const bruto = limitar(progresso, 0, 1) * total;
  const indice = limitar(Math.floor(bruto), 0, total - 1);
  const local = bruto - indice;
  // Antes da primeira e depois da última não há frase: ali a roda não gira.
  if (local < GIRO && indice > 0) {
    return indice - 0.5 + 0.5 * suave(local / GIRO);
  }
  if (local > 1 - GIRO && indice < total - 1) {
    return indice + 0.5 * suave((local - (1 - GIRO)) / GIRO);
  }
  return indice;
}

/**
 * O progresso para uma posição sob o dedo, para a roda arrastada mover a
 * página.
 *
 * Linear, e não o inverso exato de `posicaoDaRoda` (que nem existe no trecho
 * parado). O efeito é o de um seletor com engate: o dedo anda contínuo, e a
 * roda para em cada frase e salta para a próxima perto da fronteira. Nas
 * frases inteiras e nas fronteiras os dois mapeamentos concordam.
 */
export function progressoDaPosicao(posicao: number, total: number): number {
  return limitar((posicao + 0.5) / total, 0, 1);
}
