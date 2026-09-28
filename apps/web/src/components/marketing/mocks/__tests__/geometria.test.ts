import { describe, expect, it } from "vitest";
import {
  caminhoDeArea,
  caminhoSuave,
  modulosDoQr,
  parcelar,
  pontosDaSerie,
} from "../geometria";

describe("pontosDaSerie", () => {
  it("ocupa a largura inteira e inverte o eixo y", () => {
    const pontos = pontosDaSerie([0, 10], 100, 40, undefined, 0);
    expect(pontos).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 0 },
    ]);
  });

  it("séries na mesma faixa ficam na mesma escala", () => {
    const faixa = { min: 0, max: 100 };
    const baixa = pontosDaSerie([50, 50], 100, 40, faixa, 0);
    const alta = pontosDaSerie([100, 100], 100, 40, faixa, 0);
    expect(baixa[0].y).toBe(20);
    expect(alta[0].y).toBe(0);
  });

  it("série vazia não desenha nada", () => {
    expect(pontosDaSerie([], 100, 40)).toEqual([]);
    expect(caminhoSuave([])).toBe("");
    expect(caminhoDeArea([], 40)).toBe("");
  });
});

describe("caminhoSuave", () => {
  it("começa e termina nos pontos da série", () => {
    const d = caminhoSuave([
      { x: 0, y: 10 },
      { x: 50, y: 5 },
      { x: 100, y: 20 },
    ]);
    expect(d.startsWith("M0 10")).toBe(true);
    expect(d.endsWith("100 20")).toBe(true);
  });

  it("a área fecha na base", () => {
    const d = caminhoDeArea(
      [
        { x: 0, y: 10 },
        { x: 100, y: 20 },
      ],
      40,
    );
    expect(d.endsWith("L100 40 L0 40 Z")).toBe(true);
  });
});

describe("modulosDoQr", () => {
  it("é determinístico pela semente", () => {
    expect(modulosDoQr("abc")).toEqual(modulosDoQr("abc"));
    expect(modulosDoQr("abc")).not.toEqual(modulosDoQr("abd"));
  });

  it("desenha os três quadrados de posição", () => {
    const grade = modulosDoQr("pix", 25);
    for (const [linha, coluna] of [
      [0, 0],
      [0, 18],
      [18, 0],
    ]) {
      expect(grade[linha][coluna]).toBe(true);
      expect(grade[linha + 1][coluna + 1]).toBe(false);
      expect(grade[linha + 3][coluna + 3]).toBe(true);
    }
  });
});

describe("parcelar", () => {
  it("a soma das parcelas é o total, ao centavo", () => {
    const parcelas = parcelar(18400, 3);
    expect(parcelas).toEqual([6133.34, 6133.33, 6133.33]);
    expect(Math.round(parcelas.reduce((a, b) => a + b, 0) * 100)).toBe(1840000);
  });

  it("uma parcela é o total", () => {
    expect(parcelar(99.9, 1)).toEqual([99.9]);
  });
});
