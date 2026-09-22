import { describe, expect, it } from "vitest";

import { COMODOS, MOVEIS, PAREDES } from "../dados";
import { OBJETOS, atras, caixaDaParede } from "../desenho";

describe("ordem de desenho da casa", () => {
  it("todo objeto que fica atrás de outro é desenhado antes dele", () => {
    OBJETOS.forEach((a, i) => {
      OBJETOS.forEach((b, j) => {
        if (atras(a.caixa, b.caixa) && !atras(b.caixa, a.caixa)) {
          expect(i, `${a.tipo} ${a.caixa} antes de ${b.tipo} ${b.caixa}`).toBeLessThan(j);
        }
      });
    });
  });

  it("desenha tudo: paredes, móveis e um pendente por cômodo", () => {
    expect(OBJETOS.filter((o) => o.tipo === "parede")).toHaveLength(PAREDES.length);
    expect(OBJETOS.filter((o) => o.tipo === "movel")).toHaveLength(MOVEIS.length);
    expect(OBJETOS.filter((o) => o.tipo === "pendente")).toHaveLength(COMODOS.length);
  });

  it("as duas paredes do fundo vêm antes de tudo o que fica dentro da casa", () => {
    const fundo = OBJETOS.map((o, i) => ({ o, i })).filter(
      ({ o }) => o.tipo === "parede" && o.parede.tipo === "fundo",
    );
    const dentro = OBJETOS.findIndex((o) => o.tipo === "movel");
    for (const { i } of fundo) expect(i).toBeLessThan(dentro);
  });

  it("nenhuma caixa de parede atravessa outra (senão a ordem não existiria)", () => {
    const caixas = PAREDES.map(caixaDaParede);
    caixas.forEach((a, i) =>
      caixas.forEach((b, j) => {
        if (i >= j) return;
        const cruza = a[0] < b[2] - 1e-9 && b[0] < a[2] - 1e-9 && a[1] < b[3] - 1e-9 && b[1] < a[3] - 1e-9;
        expect(cruza, `${JSON.stringify(PAREDES[i])} x ${JSON.stringify(PAREDES[j])}`).toBe(false);
      }),
    );
  });

  it("todo móvel fica dentro do próprio cômodo", () => {
    for (const movel of MOVEIS) {
      const comodo = COMODOS.find((c) => c.id === movel.comodo)!;
      const [x0, z0, x1, z1] = comodo.retangulo;
      const [mx0, mz0, mx1, mz1] = movel.retangulo;
      expect(mx0 >= x0 && mz0 >= z0 && mx1 <= x1 && mz1 <= z1, `${movel.comodo} ${movel.retangulo}`).toBe(true);
    }
  });
});
