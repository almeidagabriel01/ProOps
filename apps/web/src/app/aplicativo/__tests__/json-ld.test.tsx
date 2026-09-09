import { describe, expect, it } from "vitest";

import { AplicativoJsonLd } from "../_components/aplicativo-json-ld";
import { InstitucionalJsonLd } from "../../institucional/_components/institucional-json-ld";
import { PLANOS } from "../_content/planos";
import { SITE_URLS } from "@/lib/site/surfaces";

/**
 * Structured data is a PUBLIC claim, and the two failure modes here are the
 * expensive kind: a claim that is false, and a claim that is malformed and
 * therefore silently dropped. Neither shows up in the browser.
 *
 * The components are plain server components with no hooks, so calling them as
 * functions and reading the script payload is the whole test: it asserts what
 * ships, not what a renderer might do with it.
 */

function payload(elemento: {
  props: { dangerouslySetInnerHTML: { __html: string } };
}): Record<string, unknown> {
  return JSON.parse(elemento.props.dangerouslySetInnerHTML.__html);
}

describe("JSON-LD do aplicativo", () => {
  const data = payload(AplicativoJsonLd() as never);

  it("declara um MobileApplication no host do app", () => {
    expect(data["@type"]).toBe("MobileApplication");
    expect(data.url).toBe(`${SITE_URLS.app}/`);
  });

  /**
   * O preço formatado ("R$ 24,90") faz o Google descartar a oferta em silêncio,
   * o que na prática é igual a não ter dado estruturado nenhum. schema.org quer
   * decimal com ponto, e a moeda vai em `priceCurrency`.
   */
  it("publica preço como decimal puro, e igual ao que a tela mostra", () => {
    const offers = data.offers as Array<Record<string, string>>;
    expect(offers).toHaveLength(PLANOS.length);

    offers.forEach((oferta, i) => {
      expect(oferta.name).toBe(PLANOS[i].nome);
      expect(oferta.priceCurrency).toBe("BRL");
      expect(oferta.price).toMatch(/^\d+\.\d{2}$/);
      // o mesmo número, escrito dos dois jeitos
      expect(PLANOS[i].mensal.replace(/[^\d,]/g, "").replace(",", ".")).toBe(
        oferta.price,
      );
    });
  });

  /**
   * Nota inventada em dado estruturado é violação de política do Google, com
   * penalidade manual, e custa os rich results do domínio inteiro. O app não
   * tem avaliação nenhuma.
   */
  it("não inventa avaliação", () => {
    expect(data.aggregateRating).toBeUndefined();
  });

  /**
   * O app não está publicado em loja nenhuma. Um campo de download apontando
   * para uma página que não baixa nada é pior que o campo ausente. Estes dois
   * entram no dia em que os links de loja entrarem.
   */
  it("não promete download enquanto não há loja", () => {
    expect(data.downloadUrl).toBeUndefined();
    expect(data.installUrl).toBeUndefined();
  });
});

describe("JSON-LD institucional", () => {
  const data = payload(InstitucionalJsonLd() as never);

  it("é a Organization, ancorada no apex", () => {
    expect(data["@type"]).toBe("Organization");
    expect(String(data.url)).toBe("https://proops.com.br/");
  });

  /**
   * É este campo que diz ao Google que os três domínios são uma empresa só.
   * Sem ele, dividir um domínio em três parece perder um site e ganhar dois
   * desconhecidos.
   */
  it("liga a empresa aos dois produtos, em hosts absolutos", () => {
    const owns = data.owns as Array<Record<string, string>>;
    expect(owns.map((p) => p.url)).toEqual([
      `${SITE_URLS.erp}/`,
      `${SITE_URLS.app}/`,
    ]);
    expect(owns.every((p) => p.url.startsWith("https://"))).toBe(true);
  });

  it("não carrega número que ainda é placeholder", () => {
    expect(data.aggregateRating).toBeUndefined();
    expect(data.numberOfEmployees).toBeUndefined();
    expect(data.foundingDate).toBeUndefined();
  });
});
