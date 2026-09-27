import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TenantNiche } from "@/types";
import {
  PdfProductLineFooter,
  hasProductLineFooterContent,
} from "../pdf-sistema-primitives";
import type { PdfProduct } from "../pdf-sistema-types";

/**
 * A linha de produto no PDF que o cliente final recebe: "2x R$ 10,00" na
 * automação, "Qtd. 1 | 1,2 m x 2,5 m x R$ 150,00 / m2" no preço por medida,
 * valor neutro no serviço. Estes casos travam o texto de cada combinação de
 * nicho e tipo de linha.
 */

const standard: PdfProduct = {
  productId: "p1",
  itemType: "product",
  productName: "Módulo",
  quantity: 2,
  unitPrice: 10,
  markup: 0,
  total: 20,
  pricingDetails: { mode: "standard" },
};

const byArea: PdfProduct = {
  productId: "p2",
  itemType: "product",
  productName: "Persiana",
  quantity: 3,
  unitPrice: 100,
  markup: 50,
  total: 450,
  pricingDetails: { mode: "curtain_meter", width: 1.2, height: 2.5, area: 3, panels: 1 },
};

const service: PdfProduct = {
  productId: "s1",
  itemType: "service",
  productName: "Instalação",
  quantity: 1,
  unitPrice: 200,
  markup: 0,
  total: 200,
  pricingDetails: { mode: "standard" },
};

function text(
  product: PdfProduct,
  tenantNiche: TenantNiche,
  showProductPrices: boolean,
  showProductMeasurements = true,
) {
  const html = renderToStaticMarkup(
    <PdfProductLineFooter
      product={product}
      tenantNiche={tenantNiche}
      showProductPrices={showProductPrices}
      showProductMeasurements={showProductMeasurements}
      grayTextClassName="g"
      totalTextClassName="t"
    />,
  );
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("rodapé da linha de produto no PDF", () => {
  it("automação: produto e serviço no formato Nx", () => {
    expect(text(standard, "automacao_residencial", true)).toBe("2x R$ 10,00 R$ 20,00");
    expect(text(service, "automacao_residencial", true)).toBe("1x R$ 200,00 R$ 200,00");
    expect(text(standard, "automacao_residencial", false)).toBe("Qtd: 2");
  });

  it("cortinas: produto por medida mostra a medida e o preço por unidade de medida", () => {
    expect(text(byArea, "cortinas", true)).toBe("Qtd. 1 | 1,2 m x 2,5 m x R$ 150,00 / m² R$ 450,00");
    expect(text(byArea, "cortinas", true, false)).toBe("Qtd. 1 R$ 450,00");
    expect(text(byArea, "cortinas", false)).toBe("Qtd: 1 | 1,2 m x 2,5 m");
  });

  it("cortinas: produto padrão rotulado e serviço neutro", () => {
    expect(text(standard, "cortinas", true)).toBe("Qtd. 2 x R$ 10,00 R$ 20,00");
    expect(text(standard, "cortinas", false)).toBe("Qtd: 2");
    expect(text(service, "cortinas", true)).toBe("R$ 200,00 R$ 200,00");
  });

  it("se há conteúdo para o rodapé sem preço", () => {
    const has = (product: PdfProduct, niche: TenantNiche) =>
      hasProductLineFooterContent({
        product,
        tenantNiche: niche,
        showProductPrices: false,
        showProductMeasurements: true,
      });
    expect(has(standard, "automacao_residencial")).toBe(true);
    expect(has(service, "cortinas")).toBe(false);
    expect(has(byArea, "cortinas")).toBe(true);
  });
});
