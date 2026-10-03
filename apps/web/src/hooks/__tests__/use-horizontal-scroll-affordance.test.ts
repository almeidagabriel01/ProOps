import { describe, expect, it } from "vitest";

import {
  centeredScrollLeft,
  scrollEdges,
} from "../use-horizontal-scroll-affordance";

describe("centeredScrollLeft", () => {
  // Sete visões do Financeiro numa barra de 330px: o caso que deixava a visão
  // escolhida fora da tela ao abrir a página nova.
  const base = { containerWidth: 330, scrollWidth: 760 };

  it("põe a opção do meio no centro da barra", () => {
    expect(
      centeredScrollLeft({ ...base, itemLeft: 400, itemWidth: 100 }),
    ).toBe(400 + 50 - 165);
  });

  it("não rola para antes do começo quando a opção é a primeira", () => {
    expect(centeredScrollLeft({ ...base, itemLeft: 4, itemWidth: 110 })).toBe(
      0,
    );
  });

  it("não passa do fim quando a opção é a última", () => {
    expect(
      centeredScrollLeft({ ...base, itemLeft: 650, itemWidth: 106 }),
    ).toBe(760 - 330);
  });

  it("fica em zero quando tudo cabe", () => {
    expect(
      centeredScrollLeft({
        containerWidth: 400,
        scrollWidth: 300,
        itemLeft: 200,
        itemWidth: 90,
      }),
    ).toBe(0);
  });
});

describe("scrollEdges", () => {
  it("sem esmaecido quando a fileira cabe", () => {
    expect(
      scrollEdges({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 }),
    ).toEqual({ fadeStart: false, fadeEnd: false });
  });

  it("só o fim no começo da rolagem", () => {
    expect(
      scrollEdges({ scrollLeft: 0, scrollWidth: 760, clientWidth: 330 }),
    ).toEqual({ fadeStart: false, fadeEnd: true });
  });

  it("os dois lados no meio", () => {
    expect(
      scrollEdges({ scrollLeft: 200, scrollWidth: 760, clientWidth: 330 }),
    ).toEqual({ fadeStart: true, fadeEnd: true });
  });

  it("só o começo no fim, tolerando subpixel", () => {
    expect(
      scrollEdges({ scrollLeft: 429.5, scrollWidth: 760, clientWidth: 330 }),
    ).toEqual({ fadeStart: true, fadeEnd: false });
  });
});
