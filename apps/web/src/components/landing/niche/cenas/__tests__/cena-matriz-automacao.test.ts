/**
 * Cena da automação: os símbolos ligados ficam dentro do cômodo.
 *
 * Bug: os símbolos iam numa fileira de passo fixo (56) centrada no cômodo.
 * Ligar os quatro sistemas no Quarto, o cômodo estreito da planta, punha a
 * persiana do lado de fora da parede, na borda da planta.
 */

import { describe, expect, it } from "vitest";

import { nicheLanding } from "@/lib/niches/definitions/automacao_residencial/landing";

import { posicoesNoComodo } from "../cena-matriz-automacao";

const k = 460 / 100;
// Meia largura e meia altura do maior símbolo (o Wi-Fi e as ondas do som).
const MEIA_LARGURA = 16;
const MEIA_ALTURA = 14;
// Faixa do nome do cômodo, no canto de cima.
const FAIXA_DO_NOME = 28;

const cena = nicheLanding.cena?.dados;
if (!cena || cena.tipo !== "matriz-automacao") throw new Error("cena da automação mudou de tipo");

describe("posicoesNoComodo", () => {
  for (const comodo of cena.ambientes) {
    for (let quantidade = 1; quantidade <= cena.sistemas.length; quantidade += 1) {
      it(`${quantidade} sistema(s) no(a) ${comodo.nome} cabem dentro das paredes`, () => {
        const esquerda = comodo.x * k;
        const direita = (comodo.x + comodo.w) * k;
        const topo = comodo.y * k + FAIXA_DO_NOME;
        const base = (comodo.y + comodo.h) * k;
        const posicoes = posicoesNoComodo(quantidade, comodo);

        expect(posicoes).toHaveLength(quantidade);
        for (const p of posicoes) {
          expect(p.x - MEIA_LARGURA).toBeGreaterThanOrEqual(esquerda);
          expect(p.x + MEIA_LARGURA).toBeLessThanOrEqual(direita);
          expect(p.y - MEIA_ALTURA).toBeGreaterThanOrEqual(topo);
          expect(p.y + MEIA_ALTURA).toBeLessThanOrEqual(base);
        }
      });
    }
  }

  it("símbolos não se sobrepõem", () => {
    for (const comodo of cena.ambientes) {
      const posicoes = posicoesNoComodo(cena.sistemas.length, comodo);
      for (let i = 0; i < posicoes.length; i += 1) {
        for (let j = i + 1; j < posicoes.length; j += 1) {
          const dx = Math.abs(posicoes[i].x - posicoes[j].x);
          const dy = Math.abs(posicoes[i].y - posicoes[j].y);
          expect(dx >= 2 * MEIA_LARGURA || dy >= 2 * MEIA_ALTURA).toBe(true);
        }
      }
    }
  });

  it("quando a fileira não cabe, quebra em linhas equilibradas (2x2, não 3+1)", () => {
    const quarto = cena.ambientes.find((a) => a.nome === "Quarto")!;
    const linhas = new Map<number, number>();
    for (const p of posicoesNoComodo(4, quarto)) linhas.set(p.y, (linhas.get(p.y) ?? 0) + 1);
    expect([...linhas.values()]).toEqual([2, 2]);
  });

  it("cômodo largo continua numa fileira só", () => {
    const sala = cena.ambientes.find((a) => a.nome === "Sala")!;
    const ys = new Set(posicoesNoComodo(4, sala).map((p) => p.y));
    expect(ys.size).toBe(1);
  });
});
