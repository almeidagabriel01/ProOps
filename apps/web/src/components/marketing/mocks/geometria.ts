/**
 * Geometria pura das telas codadas: a curva de um gráfico, o desenho de um QR
 * decorativo e o parcelamento em centavos. Sem React e sem DOM, para poder ser
 * testada e usada tanto em componente de servidor quanto em cena de cliente.
 */

export interface Ponto {
  x: number;
  y: number;
}

/**
 * Leva uma série de valores para dentro de uma caixa `largura` × `altura`, com o
 * eixo y invertido (SVG cresce para baixo). `faixa` fixa o mínimo e o máximo:
 * três séries no mesmo gráfico precisam da MESMA escala, senão a pessimista e a
 * otimista saem com a mesma altura e o gráfico mente.
 */
export function pontosDaSerie(
  valores: readonly number[],
  largura: number,
  altura: number,
  faixa?: { min: number; max: number },
  folga = 0.08,
): Ponto[] {
  if (valores.length === 0) return [];
  const min = faixa?.min ?? Math.min(...valores);
  const max = faixa?.max ?? Math.max(...valores);
  const amplitude = max - min || 1;
  const topo = altura * folga;
  const util = altura * (1 - folga * 2);
  const passo = valores.length > 1 ? largura / (valores.length - 1) : 0;
  return valores.map((v, i) => ({
    x: Number((i * passo).toFixed(2)),
    y: Number((topo + util * (1 - (v - min) / amplitude)).toFixed(2)),
  }));
}

/**
 * Caminho suave por Catmull-Rom convertido em Bézier cúbica. A tensão baixa
 * (0,18) arredonda as quinas sem inventar picos que a série não tem: uma curva
 * de fluxo de caixa que ultrapassa o próprio ponto parece um dado que não existe.
 */
export function caminhoSuave(pontos: readonly Ponto[], tensao = 0.18): string {
  if (pontos.length === 0) return "";
  if (pontos.length === 1) return `M${pontos[0].x} ${pontos[0].y}`;
  let d = `M${pontos[0].x} ${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i - 1] ?? pontos[i];
    const p1 = pontos[i];
    const p2 = pontos[i + 1];
    const p3 = pontos[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * tensao;
    const c1y = p1.y + (p2.y - p0.y) * tensao;
    const c2x = p2.x - (p3.x - p1.x) * tensao;
    const c2y = p2.y - (p3.y - p1.y) * tensao;
    d += ` C${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${p2.x} ${p2.y}`;
  }
  return d;
}

/** A área sob a curva, fechada na base da caixa. */
export function caminhoDeArea(pontos: readonly Ponto[], altura: number, tensao?: number): string {
  if (pontos.length === 0) return "";
  const ultimo = pontos[pontos.length - 1];
  return `${caminhoSuave(pontos, tensao)} L${ultimo.x} ${altura} L${pontos[0].x} ${altura} Z`;
}

function r(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Os módulos de um QR decorativo, determinísticos pela semente.
 *
 * NÃO é um QR válido, e não pode ser: um QR de verdade numa tela de exemplo
 * seria lido por um celular e levaria a um Pix que não existe. É só o desenho,
 * com os três quadrados de posição nos cantos, que é o que o olho reconhece.
 */
export function modulosDoQr(semente: string, lado = 25): boolean[][] {
  let estado = 2166136261;
  for (let i = 0; i < semente.length; i++) {
    estado ^= semente.charCodeAt(i);
    estado = Math.imul(estado, 16777619) >>> 0;
  }
  const aleatorio = () => {
    estado ^= estado << 13;
    estado ^= estado >>> 17;
    estado ^= estado << 5;
    estado >>>= 0;
    return estado / 4294967296;
  };

  const grade = Array.from({ length: lado }, () =>
    Array.from({ length: lado }, () => aleatorio() > 0.52),
  );

  const localizador = (linha: number, coluna: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const gy = linha + y;
        const gx = coluna + x;
        if (gy < 0 || gx < 0 || gy >= lado || gx >= lado) continue;
        const borda = y === 0 || y === 6 || x === 0 || x === 6;
        const miolo = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        const dentro = y >= 0 && y <= 6 && x >= 0 && x <= 6;
        grade[gy][gx] = dentro && (borda || miolo);
      }
    }
  };
  localizador(0, 0);
  localizador(0, lado - 7);
  localizador(lado - 7, 0);
  return grade;
}

/**
 * Divide um total em parcelas, em centavos, sem perder nem inventar um
 * centavo: a sobra vai para a primeira. É o que faz a soma das parcelas de uma
 * tela de exemplo bater com o total que a mesma tela mostra.
 */
export function parcelar(total: number, parcelas: number): number[] {
  const centavos = Math.round(total * 100);
  const n = Math.max(1, Math.floor(parcelas));
  const base = Math.floor(centavos / n);
  const sobra = centavos - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < sobra ? 1 : 0)) / 100);
}
