import type { InventoryDefinition } from "./config-types";

/** Estoque por unidade e por metragem, reaproveitados pelos nichos. */
export const unitInventoryDefinition: InventoryDefinition = {
  mode: "unit",
  unitLabel: "unidades",
  unitSuffix: "un",
  priceSuffix: "",
  tableHeader: "Estoque",
  formLabel: "Estoque",
  formInitialLabel: "Estoque Inicial",
  readOnlyLabel: "Estoque",
  pageDescription: "Gerencie o catálogo de produtos, estoque e preços.",
  emptyStateDescription:
    "Cadastre seus produtos para gerenciar estoque e criar propostas.",
  costBalanceLabel: "Saldo de custo em estoque",
  revenueBalanceLabel: "Saldo com markup em estoque",
  lowValueThreshold: 10,
  step: 1,
};

export const meterInventoryDefinition: InventoryDefinition = {
  mode: "meter",
  unitLabel: "metros",
  unitSuffix: "m",
  priceSuffix: "/ m",
  tableHeader: "Metragem",
  formLabel: "Metragem",
  formInitialLabel: "Metragem Inicial",
  readOnlyLabel: "Metragem",
  pageDescription:
    "Gerencie o catálogo de persianas, cortinas e toldos, a metragem disponível e os preços.",
  emptyStateDescription:
    "Cadastre tecidos, lonas, modelos e motores para controlar a metragem disponível e montar propostas.",
  costBalanceLabel: "Saldo de custo em metragem",
  revenueBalanceLabel: "Saldo com markup em metragem",
  lowValueThreshold: 10,
  step: 0.01,
};

/**
 * Estoque por área: vidro e chapa se contam em m², não em metro linear. O
 * modo continua `meter` (é o que fica gravado no produto); muda o que a tela diz.
 */
export const areaInventoryDefinition: InventoryDefinition = {
  ...meterInventoryDefinition,
  unitLabel: "metros quadrados",
  unitSuffix: "m²",
  priceSuffix: "/ m²",
  tableHeader: "Metragem (m²)",
  formLabel: "Metragem (m²)",
  formInitialLabel: "Metragem inicial (m²)",
  readOnlyLabel: "Metragem (m²)",
};
