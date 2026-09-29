import type { ProductPricingMode } from "@/lib/product-pricing";

/**
 * O pedaço do módulo que a cena usa: o título (vira o rótulo da aba) e o modo
 * de preço. Sem o ícone, que é um componente e não atravessa a fronteira do
 * servidor para a ilha de cliente.
 */
export interface ModuloDaCena {
  title: string;
  modo?: ProductPricingMode;
}
