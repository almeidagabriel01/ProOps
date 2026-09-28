import {
  calculateProposalProductPricing,
  getProposalProductMeasurementLabel,
  type ProductPricingModel,
  type ProposalProductPricingDetails,
} from "@/lib/product-pricing";

/**
 * As propostas de exemplo das landings de nicho, calculadas com o MESMO motor
 * de preço da proposta de verdade (`lib/product-pricing.ts`).
 *
 * O que a landing mostra é o que o produto calcularia com aqueles números: o
 * total de "Persiana rolô, 2,40 m x 1,80 m" sai de `calculateProposalProductPricing`,
 * e o rótulo da medida sai de `getProposalProductMeasurementLabel`, que é o
 * mesmo texto do PDF. Um total digitado à mão aqui mentiria na primeira
 * mudança de regra de preço, e uma landing que promete "o total sai na hora"
 * com um número que o sistema não chega é exatamente o tipo de erro que
 * ninguém percebe até o cliente comparar.
 *
 * Os preços e as medidas são FICTÍCIOS: dados de demonstração, como os do
 * portal de exemplo.
 */

export interface ProdutoDeExemplo {
  /** Custo, antes do markup. */
  price: number;
  /** Markup em %. */
  markup: number;
  pricingModel: ProductPricingModel;
}

export interface ItemDeExemplo {
  descricao: string;
  produto: ProdutoDeExemplo;
  /** Para produto por unidade. */
  quantidade?: number;
  /** Para produto por medida, em metros. */
  medidas?: { largura?: number; altura?: number; paineis?: number; faixaId?: string };
}

export interface ItemCalculado {
  descricao: string;
  medida: string;
  /** O que é cobrado: m², metros de largura ou unidades. */
  quantidade: number;
  /** Preço de venda por unidade de cobrança, já com o markup. */
  precoUnitario: number;
  total: number;
}

function detalhes(item: ItemDeExemplo): ProposalProductPricingDetails | undefined {
  const modelo = item.produto.pricingModel;
  const m = item.medidas ?? {};
  const largura = m.largura ?? 0;
  const paineis = m.paineis ?? 1;
  switch (modelo.mode) {
    case "curtain_meter": {
      const altura = m.altura ?? 0;
      return { mode: "curtain_meter", width: largura, height: altura, area: largura * altura, panels: paineis };
    }
    case "curtain_width":
      return { mode: "curtain_width", width: largura, panels: paineis };
    case "curtain_height": {
      const faixa = modelo.tiers.find((t) => t.id === m.faixaId) ?? modelo.tiers[0];
      return {
        mode: "curtain_height",
        width: largura,
        tierId: faixa?.id ?? "",
        maxHeight: faixa?.maxHeight ?? 0,
        panels: paineis,
      };
    }
    default:
      return undefined;
  }
}

/** Um item com o total e o rótulo de medida que o produto daria. */
export function calcularItem(item: ItemDeExemplo): ItemCalculado {
  const pricingDetails = detalhes(item);
  const resultado = calculateProposalProductPricing({
    price: item.produto.price,
    markup: item.produto.markup,
    pricingModel: item.produto.pricingModel,
    quantity: item.quantidade ?? 1,
    unitPrice: item.produto.price,
    pricingDetails,
  });
  return {
    descricao: item.descricao,
    medida: getProposalProductMeasurementLabel({
      pricingDetails: resultado.pricingDetails,
      quantity: resultado.quantity,
    }),
    quantidade: resultado.quantity,
    precoUnitario: resultado.sellingPrice,
    total: resultado.total,
  };
}

/**
 * A faixa de altura em que uma altura cai: a primeira cujo teto a comporta,
 * ou a última, se a altura passar de todas. É a regra que a pessoa aplica ao
 * escolher a faixa na proposta.
 */
export function faixaParaAltura(
  faixas: readonly { id: string; maxHeight: number }[],
  altura: number,
): string {
  const ordenadas = [...faixas].sort((a, b) => a.maxHeight - b.maxHeight);
  return (ordenadas.find((f) => altura <= f.maxHeight) ?? ordenadas[ordenadas.length - 1])?.id ?? "";
}

/** Soma em centavos, para 0,1 + 0,2 não virar 0,30000000000000004 na tela. */
export function somar(valores: readonly number[]): number {
  return valores.reduce((soma, v) => soma + Math.round(v * 100), 0) / 100;
}
