import { describe, expect, it } from "vitest";

import { calcularItem, faixaParaAltura, somar } from "@/lib/landing/proposta-de-exemplo";

describe("proposta de exemplo", () => {
  it("por área: largura x altura x painéis x preço com markup", () => {
    const item = calcularItem({
      descricao: "Persiana rolô",
      produto: { price: 100, markup: 50, pricingModel: { mode: "curtain_meter" } },
      medidas: { largura: 2, altura: 1.5 },
    });
    expect(item.total).toBe(450);
    expect(item.medida).toBe("2 m x 1,5 m");
  });

  it("por largura: metros x preço com markup", () => {
    const item = calcularItem({
      descricao: "Toldo",
      produto: { price: 200, markup: 0, pricingModel: { mode: "curtain_width" } },
      medidas: { largura: 3.2 },
    });
    expect(item.total).toBe(640);
    expect(item.medida).toBe("Largura 3,2 m");
  });

  it("por faixa de altura: usa o preço da faixa escolhida", () => {
    const tiers = [
      { id: "baixa", maxHeight: 1.6, basePrice: 100, markup: 0 },
      { id: "alta", maxHeight: 3, basePrice: 150, markup: 0 },
    ];
    const item = calcularItem({
      descricao: "Cortina",
      produto: { price: 0, markup: 0, pricingModel: { mode: "curtain_height", tiers } },
      medidas: { largura: 2, faixaId: faixaParaAltura(tiers, 2.2) },
    });
    expect(item.total).toBe(300);
  });

  it("a faixa é a primeira que comporta a altura, ou a última", () => {
    const faixas = [
      { id: "b", maxHeight: 2.4 },
      { id: "a", maxHeight: 1.6 },
    ];
    expect(faixaParaAltura(faixas, 1.2)).toBe("a");
    expect(faixaParaAltura(faixas, 1.6)).toBe("a");
    expect(faixaParaAltura(faixas, 2)).toBe("b");
    expect(faixaParaAltura(faixas, 9)).toBe("b");
  });

  it("por unidade: quantidade x preço com markup", () => {
    const item = calcularItem({
      descricao: "Motor",
      produto: { price: 300, markup: 20, pricingModel: { mode: "standard" } },
      quantidade: 2,
    });
    expect(item.total).toBe(720);
  });

  it("a soma fecha ao centavo", () => {
    expect(somar([0.1, 0.2])).toBe(0.3);
  });
});
