/**
 * A projeção do mês da cena "posso comprar um celular de 3 mil?", em números.
 *
 * Fica fora do componente porque é a parte que dá para conferir: a queda no
 * dia da compra tem que valer exatamente o preço, o cenário à vista tem que
 * terminar no valor que a ficha mostra, e a contagem de dias no vermelho tem
 * que sair da série, não de um texto digitado à mão.
 */

export const DIAS_DO_MES = 30;
/** Dia em que a pessoa pergunta. A projeção antes dele é histórico. */
export const HOJE = 17;
export const PRECO = 3000;

/** Saldo projetado do dia 1 até hoje: o mês como ele foi. */
export const ATE_HOJE = [
  4400, 4320, 4100, 3980, 3700, 3650, 3400, 3250, 3200, 2980, 2900, 2760, 2700,
  2600, 2520, 2460, 2400,
];

/** De hoje ao dia 30, sem a compra. Termina na sobra que a ficha promete. */
export const SEM_COMPRAR = [
  2400, 2320, 2200, 2100, 2050, 1900, 1820, 1760, 1650, 1560, 1480, 1400, 1330,
  1284.9,
];

/** O mesmo mês com o celular à vista: o preço sai todo no dia da compra. */
export const A_VISTA = SEM_COMPRAR.map((valor) => valor - PRECO);

/** Em 10x, só a primeira parcela pesa neste mês. */
export const SOBRA_EM_10X = SEM_COMPRAR[SEM_COMPRAR.length - 1] - PRECO / 10;

export const CAIXA = { largura: 480, altura: 210 };
/** Sobra à esquerda para os valores do eixo, e à direita para a última coluna. */
export const MARGEM = { esquerda: 46, direita: 16, topo: 14, base: 26 };

const TETO = 4600;
const PISO = -2300;

/** Onde um dia do mês cai, em coordenadas do desenho. */
export function eixoX(dia: number): number {
  const util = CAIXA.largura - MARGEM.esquerda - MARGEM.direita;
  return MARGEM.esquerda + ((dia - 1) / (DIAS_DO_MES - 1)) * util;
}

/** Onde um valor em reais cai, em coordenadas do desenho. */
export function eixoY(valor: number): number {
  const util = CAIXA.altura - MARGEM.topo - MARGEM.base;
  const fatia = (TETO - valor) / (TETO - PISO);
  return MARGEM.topo + fatia * util;
}

/** A linha de uma série que começa no dia `inicio`. */
export function caminho(serie: number[], inicio: number): string {
  return serie
    .map(
      (valor, i) =>
        `${i === 0 ? "M" : "L"}${eixoX(inicio + i).toFixed(1)} ${eixoY(valor).toFixed(1)}`,
    )
    .join(" ");
}

/**
 * A área entre a série e uma referência (o zero, ou a base do desenho). É ela
 * que dá volume ao gráfico: uma linha de 2px sozinha lê como régua.
 */
export function area(
  serie: number[],
  inicio: number,
  referencia: number,
): string {
  const y = eixoY(referencia).toFixed(1);
  const primeiro = eixoX(inicio).toFixed(1);
  const ultimo = eixoX(inicio + serie.length - 1).toFixed(1);
  const linha = caminho(serie, inicio).replace(/^M/, "L");
  return `M${primeiro} ${y} ${linha} L${ultimo} ${y} Z`;
}

/** Quantos dias do mês terminam abaixo de zero no cenário à vista. */
export function diasNoVermelho(serie: number[]): number {
  return serie.filter((valor) => valor < 0).length;
}
