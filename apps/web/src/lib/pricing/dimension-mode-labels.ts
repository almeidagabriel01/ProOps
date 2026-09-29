import type { DimensionPricingMode } from "@/lib/product-pricing";
import type { PricingDefinition } from "@/lib/niches/config-types";
import { term, type Term } from "@/lib/niches/vocabulary";

/**
 * Como cada modo de preço por medida aparece na tela. Os ids (`curtain_*`)
 * são históricos e ficam gravados em produtos e propostas; o nome que a
 * pessoa lê vem daqui, e um nicho pode trocá-lo em `pricing.modeLabels`
 * (marcenaria diria "Por m² de chapa" onde persianas diz "Por metragem").
 */
export interface DimensionModeLabel {
  /** Nome curto: botão do formulário de produto e selo na proposta. */
  short: string;
  /** Uma frase sobre como o preço é calculado. */
  description: string;
  /** Título da seção de regra no formulário de produto. */
  ruleTitle: string;
}

export const DEFAULT_DIMENSION_MODE_LABELS: Record<DimensionPricingMode, DimensionModeLabel> = {
  curtain_meter: {
    short: "Por metragem",
    description: "Usa largura x altura x preço com markup na proposta.",
    ruleTitle: "Regra por metragem",
  },
  curtain_height: {
    short: "Por altura",
    description: "Usa faixa de altura e multiplica pela largura preenchida na proposta.",
    ruleTitle: "Faixas por altura",
  },
  curtain_width: {
    short: "Por largura",
    description: "Usa apenas largura e multiplica pelo preço com markup na proposta.",
    ruleTitle: "Regra por largura linear",
  },
};

export function dimensionModeLabel(
  pricing: Pick<PricingDefinition, "modeLabels">,
  mode: DimensionPricingMode,
): DimensionModeLabel {
  return { ...DEFAULT_DIMENSION_MODE_LABELS[mode], ...pricing.modeLabels?.[mode] };
}

/** O nome das medidas que um modo pede na tela. */
export interface MeasureTerms {
  width: Term;
  height: Term;
}

export const DEFAULT_MEASURE_TERMS: MeasureTerms = {
  width: term("largura", "larguras", "f"),
  height: term("altura", "alturas", "f"),
};

export function measureTerms(
  pricing: Pick<PricingDefinition, "measureLabels">,
  mode: DimensionPricingMode,
): MeasureTerms {
  const override = pricing.measureLabels?.[mode];
  return {
    width: override?.width ?? DEFAULT_MEASURE_TERMS.width,
    height: override?.height ?? DEFAULT_MEASURE_TERMS.height,
  };
}

/** A unidade do preço por medida linear: "m larg." no padrão, "m" na tubulação. */
export function linearPriceUnit(
  pricing: Pick<PricingDefinition, "measureLabels">,
  mode: "curtain_width" | "curtain_height",
): string {
  return pricing.measureLabels?.[mode]?.priceUnit ?? "m larg.";
}
