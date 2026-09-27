import { describe, expect, it } from "vitest";
import { calculateProposalProductPricing as backend } from "../../../functions/src/shared/dimension-pricing";
import { calculateProposalProductPricing as front } from "@/lib/product-pricing";

/**
 * A Lia monta a proposta no servidor com a cópia do backend deste cálculo, e a
 * tela recalcula com a do front. Se as duas divergirem, a proposta criada pela
 * Lia muda de valor na primeira vez que alguém a abre e salva.
 */
const tiers = [
  { id: "a", maxHeight: 2.2, basePrice: 100, markup: 50 },
  { id: "b", maxHeight: 2.8, basePrice: "120,5", markup: "40" },
];

const cases: Array<[string, Parameters<typeof front>[0]]> = [
  ["padrão com markup", { price: 100, markup: 25, quantity: 3 }],
  ["padrão com texto", { price: "99,90", markup: "10", quantity: 2 }],
  ["padrão com unitPrice gravado", { price: 100, unitPrice: 80, markup: 0, quantity: 1 }],
  [
    "área com painéis",
    {
      price: 100,
      markup: 50,
      pricingModel: { mode: "curtain_meter" },
      pricingDetails: { mode: "curtain_meter", width: 1.23, height: 2.51, area: 0, panels: 3 },
    },
  ],
  ["área sem medidas", { price: 100, pricingModel: { mode: "curtain_meter" } }],
  [
    "largura",
    {
      price: 80,
      markup: 25,
      pricingModel: { mode: "curtain_width" },
      pricingDetails: { mode: "curtain_width", width: 3.333, panels: 2 },
    },
  ],
  [
    "faixa de altura",
    {
      pricingModel: { mode: "curtain_height", tiers } as never,
      pricingDetails: { mode: "curtain_height", width: 2, tierId: "b", maxHeight: 0, panels: 1 },
    },
  ],
  [
    "faixa inexistente",
    {
      pricingModel: { mode: "curtain_height", tiers } as never,
      pricingDetails: { mode: "curtain_height", width: 1, tierId: "z", maxHeight: 0, panels: 2 },
    },
  ],
];

describe("cálculo da linha: front e backend iguais", () => {
  it.each(cases)("%s", (_label, source) => {
    expect(backend(source as never)).toEqual(front(source));
  });
});
