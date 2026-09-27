import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TenantNiche } from "@/types";
import { PdfSistemaBlock } from "../pdf-sistema-block";
import {
  resolveSistemaAmbientes,
  type PdfProduct,
  type PdfSistema,
} from "../pdf-sistema-types";

/**
 * O PDF roda em `/share`, sem TenantProvider: o nicho chega por prop e o
 * vocabulário sai de `getNicheConfig(tenantNiche)`. Um hook aqui devolveria
 * automação em silêncio, e a proposta de segurança sairia falando "Ambiente"
 * e "Solução" para o cliente final.
 */

// Seleção legada: sem `ambientes` e sem nome de local, o caso do fallback.
const legacySistema: PdfSistema = {
  sistemaId: "sis1",
  sistemaName: "CFTV",
  ambienteId: "amb1",
};

const product: PdfProduct = {
  productId: "p1",
  itemType: "product",
  productName: "Câmera bullet",
  quantity: 2,
  unitPrice: 100,
  markup: 0,
  total: 200,
  systemInstanceId: "sis1-amb1",
};

function text(tenantNiche: TenantNiche) {
  const html = renderToStaticMarkup(
    <PdfSistemaBlock
      sistema={legacySistema}
      products={[product]}
      primaryColor="#000000"
      tenantNiche={tenantNiche}
    />,
  );
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("bloco do grupo no PDF: vocabulário do nicho", () => {
  it("segurança: o local sem nome é Área e o subtotal é do Sistema", () => {
    const pdf = text("seguranca_eletronica");
    expect(pdf).toContain("ÁREA");
    expect(pdf).not.toContain("AMBIENTE");
    expect(pdf).toContain("Subtotal do Sistema:");
    expect(pdf).not.toContain("Solução");
  });

  it("automação: continua Ambiente e Subtotal da Solução", () => {
    const pdf = text("automacao_residencial");
    expect(pdf).toContain("AMBIENTE");
    expect(pdf).not.toContain("ÁREA");
    expect(pdf).toContain("Subtotal da Solução:");
  });

  it("nicho ausente (proposta antiga) cai no vocabulário padrão", () => {
    const html = renderToStaticMarkup(
      <PdfSistemaBlock
        sistema={legacySistema}
        products={[product]}
        primaryColor="#000000"
      />,
    );
    expect(html).toContain("AMBIENTE");
  });
});

describe("resolveSistemaAmbientes", () => {
  it("usa o rótulo recebido quando a seleção legada não tem nome de local", () => {
    expect(resolveSistemaAmbientes(legacySistema, "Área")).toEqual([
      { ambienteName: "Área", ambienteId: "amb1" },
    ]);
  });

  it("mantém o nome gravado quando existe", () => {
    expect(
      resolveSistemaAmbientes(
        { ...legacySistema, ambienteName: "Portaria" },
        "Área",
      ),
    ).toEqual([{ ambienteName: "Portaria", ambienteId: "amb1" }]);
  });

  it("prefere a lista de locais à seleção legada", () => {
    const ambientes = [{ ambienteId: "a2", ambienteName: "Garagem" }];
    expect(
      resolveSistemaAmbientes({ ...legacySistema, ambientes }, "Área"),
    ).toBe(ambientes);
  });
});
