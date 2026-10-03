import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultPdfDisplaySettings } from "@/types/pdf-display-settings";
import type { PdfProductLayout } from "@/types/pdf-display-settings";
import {
  chunkProducts,
  groupProductArrangement,
  looseProductArrangement,
  resolvePdfProductLayout,
} from "../product-layout";
import { buildContentItems, type Product } from "../render-paged-content.helpers";
import { PdfProductTableRow } from "../components/pdf-product-table";

/**
 * Layout dos produtos no PDF. "Padrão" tem que continuar sendo o PDF de
 * sempre (pares nos grupos, card grande nos avulsos); os outros três valem
 * nos dois lugares. Na tabela, a linha de medida do nicho continua aparecendo.
 */

const product = (id: string, extra: Partial<Product> = {}): Product => ({
  productId: id,
  itemType: "product",
  productName: `Produto ${id}`,
  quantity: 1,
  unitPrice: 100,
  total: 100,
  ...extra,
});

const settingsFor = (productLayout?: PdfProductLayout) => ({
  ...defaultPdfDisplaySettings,
  ...(productLayout ? { productLayout } : {}),
});

function typesFor(layout: PdfProductLayout | undefined, sistemas: boolean, count = 3) {
  const products = Array.from({ length: count }, (_, i) =>
    product(`p${i}`, sistemas ? { systemInstanceId: "s1-a1" } : {}),
  );
  const proposal = {
    clientName: "Cliente",
    sistemas: sistemas
      ? [
          {
            sistemaId: "s1",
            sistemaName: "Iluminação",
            ambientes: [{ ambienteId: "a1", ambienteName: "Sala", productIds: products.map((p) => p.productId) }],
          },
        ]
      : [],
  };
  return buildContentItems([], products, proposal, "#123456", settingsFor(layout), "automacao_residencial")
    .map((item) => item.type)
    .filter((type) => type !== "totals" && type !== "payment-terms");
}

describe("resolvePdfProductLayout", () => {
  it("valor ausente ou desconhecido e o padrao", () => {
    expect(resolvePdfProductLayout(undefined)).toBe("default");
    expect(resolvePdfProductLayout("mosaico")).toBe("default");
    expect(resolvePdfProductLayout("table")).toBe("table");
  });

  it("arranjo por layout", () => {
    expect(groupProductArrangement("default")).toBe("pairs");
    expect(groupProductArrangement("grid")).toBe("pairs");
    expect(groupProductArrangement("list")).toBe("single");
    expect(groupProductArrangement("table")).toBe("table");
    expect(looseProductArrangement("default")).toBe("rows");
    expect(looseProductArrangement("grid")).toBe("pairs");
    expect(looseProductArrangement("list")).toBe("rows");
    expect(looseProductArrangement("table")).toBe("table");
  });

  it("chunkProducts", () => {
    expect(chunkProducts([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
    expect(chunkProducts([1, 2], 1)).toEqual([[1], [2]]);
  });
});

describe("itens avulsos (proposta sem grupos)", () => {
  it("padrao: o card grande de sempre, um por linha", () => {
    expect(typesFor(undefined, false)).toEqual(["product-header", "product-row", "product-row", "product-row"]);
    expect(typesFor("default", false)).toEqual(typesFor(undefined, false));
  });

  it("grade: pares de cards", () => {
    expect(typesFor("grid", false)).toEqual(["product-header", "product-pair", "product-pair"]);
  });

  it("tabela: cabecalho e uma linha por item", () => {
    expect(typesFor("table", false)).toEqual([
      "product-header",
      "product-table-head",
      "product-table-row",
      "product-table-row",
      "product-table-row",
    ]);
  });
});

describe("grupos grandes (quebrados em paginas)", () => {
  const groupTypes = (layout?: PdfProductLayout) =>
    typesFor(layout, true, 30).filter((type) => !type.startsWith("sistema-header") && type !== "ambiente-header" && type !== "sistema-footer");

  it("padrao: pares", () => {
    const types = groupTypes(undefined);
    expect(types.every((type) => type === "sistema-product-pair")).toBe(true);
    expect(types).toHaveLength(15);
  });

  it("lista: um card por linha", () => {
    expect(groupTypes("list")).toHaveLength(30);
  });

  it("tabela: cabecalho emoldurado e linhas", () => {
    const items = buildContentItems(
      [],
      Array.from({ length: 30 }, (_, i) => product(`p${i}`, { systemInstanceId: "s1-a1" })),
      {
        clientName: "Cliente",
        sistemas: [{ sistemaId: "s1", sistemaName: "Iluminação", ambientes: [{ ambienteId: "a1", ambienteName: "Sala" }] }],
      },
      "#123456",
      settingsFor("table"),
      "automacao_residencial",
    );
    const head = items.find((item) => item.type === "product-table-head");
    expect(head?.data).toEqual({ framed: true });
    expect(items.filter((item) => item.type === "product-table-row")).toHaveLength(30);
  });
});

describe("PdfProductTableRow por nicho", () => {
  const curtain: Product = product("cortina", {
    quantity: 1,
    pricingDetails: { mode: "curtain_width", width: 2.4, panels: 1 },
  });

  it("persianas: a medida continua na linha da tabela", () => {
    const html = renderToStaticMarkup(
      <PdfProductTableRow
        product={curtain}
        settings={{ ...defaultPdfDisplaySettings, showProductPrices: true }}
        primaryColor="#123456"
        index={0}
        tenantNiche="cortinas"
      />,
    );
    expect(html).toContain("Produto cortina");
    expect(html).toMatch(/2,4/);
  });

  it("automacao: quantidade e preco no formato do nicho", () => {
    const html = renderToStaticMarkup(
      <PdfProductTableRow
        product={product("modulo", { quantity: 2, total: 200 })}
        settings={{ ...defaultPdfDisplaySettings, showProductPrices: true }}
        primaryColor="#123456"
        index={0}
        tenantNiche="automacao_residencial"
      />,
    );
    expect(html).toContain("2x");
    expect(html).toContain("200,00");
  });

  it("sem a caixinha de imagem, sem coluna de miniatura", () => {
    const html = renderToStaticMarkup(
      <PdfProductTableRow
        product={product("modulo")}
        settings={{ ...defaultPdfDisplaySettings, showProductImages: false }}
        primaryColor="#123456"
        index={0}
        tenantNiche="automacao_residencial"
      />,
    );
    expect(html.match(/<col[\s/>]/g)).toHaveLength(2);
  });
});
