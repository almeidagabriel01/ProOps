import { describe, expect, it } from "vitest";

import {
  COMODOS,
  ITENS,
  NICHOS,
  LARGURA_DA_CASA,
  PAGAMENTO,
  PAREDES,
  PROFUNDIDADE_DA_CASA,
  PROPOSTA,
  TOTAL_CENTAVOS,
  divisaoDoPagamento,
  formataReais,
  type Parede,
} from "../dados";

/** Uma borda de cômodo está coberta se alguma parede colinear a contém. */
function coberta(eixo: "x" | "z", fixo: number, de: number, ate: number, paredes: readonly Parede[]) {
  return paredes.some(
    (p) => p.eixo === eixo && p.fixo === fixo && p.de <= de && p.ate >= ate,
  );
}

describe("cena-planta", () => {
  it("a proposta de exemplo usa o código que o produto imprimiria", () => {
    expect(PROPOSTA.codigo).toBe("0018926SP");
  });

  it("o total é R$ 31.000,00, em centavos inteiros", () => {
    expect(TOTAL_CENTAVOS).toBe(3_100_000);
    for (const item of ITENS) expect(Number.isInteger(item.centavos)).toBe(true);
  });

  it("entrada de 40% e três parcelas iguais que fecham o total ao centavo", () => {
    expect(PAGAMENTO.entrada).toBe(1_240_000);
    expect(PAGAMENTO.parcelas).toEqual([620_000, 620_000, 620_000]);
    expect(PAGAMENTO.entrada + PAGAMENTO.parcelas.reduce((a, b) => a + b, 0)).toBe(
      TOTAL_CENTAVOS,
    );
  });

  it("a sobra de arredondamento vai para a última parcela", () => {
    const { entrada, parcelas } = divisaoDoPagamento(100_001, 40, 3);
    expect(entrada + parcelas.reduce((a, b) => a + b, 0)).toBe(100_001);
    expect(parcelas[2]).toBeGreaterThanOrEqual(parcelas[0]);
  });

  it("o formatador dá o valor que a proposta mostra", () => {
    // O Intl põe um espaço inseparável entre o símbolo e o número.
    expect(formataReais(PAGAMENTO.entrada).replace(/\s/g, " ")).toBe("R$ 12.400,00");
  });

  it("cada nicho reescreve os MESMOS itens, um rótulo por item", () => {
    expect(NICHOS.length).toBeGreaterThanOrEqual(2);
    for (const nicho of NICHOS) {
      expect(nicho.rotulos, nicho.id).toHaveLength(ITENS.length);
      for (const rotulo of nicho.rotulos) expect(rotulo.trim().length).toBeGreaterThan(2);
      // Rótulo repetido dentro do mesmo nicho vira duas linhas iguais na
      // proposta, e o leitor lê como erro do sistema.
      expect(new Set(nicho.rotulos).size, nicho.id).toBe(nicho.rotulos.length);
    }
    expect(new Set(NICHOS.map((n) => n.id)).size).toBe(NICHOS.length);
  });

  it("todo item pertence a um cômodo, e toda cortina tem janela", () => {
    for (const item of ITENS) {
      const comodo = COMODOS.find((c) => c.id === item.comodo);
      expect(comodo, item.id).toBeDefined();
      if (item.cortina) expect(comodo?.janela, item.id).toBeDefined();
    }
    const ids = ITENS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo cômodo tem ao menos um item: nenhum fica apagado no quadro final", () => {
    for (const comodo of COMODOS) {
      expect(ITENS.some((i) => i.comodo === comodo.id), comodo.id).toBe(true);
    }
  });

  it("os cômodos cobrem a casa sem se sobrepor", () => {
    const area = COMODOS.reduce((soma, c) => {
      const [x0, z0, x1, z1] = c.retangulo;
      expect(x0).toBeLessThan(x1);
      expect(z0).toBeLessThan(z1);
      return soma + (x1 - x0) * (z1 - z0);
    }, 0);
    expect(area).toBe(LARGURA_DA_CASA * PROFUNDIDADE_DA_CASA);
    for (const a of COMODOS)
      for (const b of COMODOS) {
        if (a === b) continue;
        const [ax0, az0, ax1, az1] = a.retangulo;
        const [bx0, bz0, bx1, bz1] = b.retangulo;
        const sobrepoe = ax0 < bx1 && bx0 < ax1 && az0 < bz1 && bz0 < az1;
        expect(sobrepoe, `${a.id} x ${b.id}`).toBe(false);
      }
  });

  it("toda borda de cômodo tem parede em cima (as paredes são declaradas à mão)", () => {
    for (const comodo of COMODOS) {
      const [x0, z0, x1, z1] = comodo.retangulo;
      expect(coberta("x", z0, x0, x1, PAREDES), `${comodo.id} fundo`).toBe(true);
      expect(coberta("x", z1, x0, x1, PAREDES), `${comodo.id} frente`).toBe(true);
      expect(coberta("z", x0, z0, z1, PAREDES), `${comodo.id} esquerda`).toBe(true);
      expect(coberta("z", x1, z0, z1, PAREDES), `${comodo.id} direita`).toBe(true);
    }
  });

  it("as janelas ficam nas paredes do fundo, dentro do próprio cômodo", () => {
    for (const comodo of COMODOS) {
      const janela = comodo.janela;
      if (!janela) continue;
      const [x0, z0, x1, z1] = comodo.retangulo;
      if (janela.parede === "fundo") {
        expect(z0, comodo.id).toBe(0);
        expect(janela.de).toBeGreaterThanOrEqual(x0);
        expect(janela.ate).toBeLessThanOrEqual(x1);
      } else {
        expect(x0, comodo.id).toBe(0);
        expect(janela.de).toBeGreaterThanOrEqual(z0);
        expect(janela.ate).toBeLessThanOrEqual(z1);
      }
      expect(janela.peitoril).toBeLessThan(janela.verga);
    }
  });
});
